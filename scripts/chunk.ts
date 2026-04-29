/**
 * Chunker
 *
 * Walks source/, splits each .md file at H1/H2 boundaries (Pass 1),
 * then sub-splits any H1/H2 chunk over TOKEN_MAX along H3 boundaries
 * (Pass 2, Day 4). Writes atomic chunks to build/chunks/ and an index
 * to build/chunks-index.json.
 *
 * Why these limits:
 * - bge-small-en-v1.5 has a 512-token max input. We target 1000 tokens
 *   on disk because the model truncates, but downstream consumers may
 *   re-chunk with overlap. The min/max here are about embedding signal,
 *   not model limits.
 * - chars / 4 is the standard rough token estimate for English prose;
 *   close enough for budgeting without pulling in a tokenizer dep.
 *
 * Why two-pass:
 * - react.dev "Usage" H2 sections regularly hit 5,000–13,000 tokens
 *   inside one heading, which the embedder truncates at 512 tokens.
 *   Splitting along H3 keeps semantic units intact while staying in
 *   the model's effective input window.
 */

import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_DIR = "source";
const BUILD_DIR = "build";
const CHUNKS_DIR = join(BUILD_DIR, "chunks");
const INDEX_PATH = join(BUILD_DIR, "chunks-index.json");

const TOKEN_TARGET = 1000;
const TOKEN_MIN = 200;
const TOKEN_MAX = 1500;

interface ChunkRecord {
  id: string;
  sourcePath: string;
  chunkPath: string;
  topic: string;
  subtopic: string;
  title: string;
  tokenEstimate: number;
  characterCount: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

async function walkMarkdown(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(full, files);
    } else if (entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

interface RawSplit {
  title: string;
  body: string;
}

/**
 * Split a markdown body at H1/H2 boundaries.
 * Lines starting with "# " or "## " (followed by a space) start a new chunk.
 * The heading line itself is preserved as the first line of the chunk.
 */
function splitByHeadings(content: string): RawSplit[] {
  const lines = content.split(/\r?\n/);
  const chunks: RawSplit[] = [];
  let current: string[] = [];
  let currentTitle = "";

  const flush = () => {
    if (current.length === 0) return;
    const body = current.join("\n").trim();
    if (body.length === 0) return;
    chunks.push({ title: currentTitle, body });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,2})\s+(.*)$/);
    if (headingMatch) {
      flush();
      current = [line];
      currentTitle = headingMatch[2].trim();
    } else {
      current.push(line);
    }
  }
  flush();

  return chunks;
}

interface H3Boundary {
  line: number;
  title: string;
}

/**
 * Find H3 boundaries in a markdown body, skipping `### ` lines that
 * appear inside fenced code blocks (``` or ~~~). Used by the
 * Pass-2 splitter to avoid false matches against shell prompts,
 * code comments, etc. that happen to start with three hashes.
 */
function findH3Boundaries(content: string): H3Boundary[] {
  const lines = content.split(/\r?\n/);
  const result: H3Boundary[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^### (.+)$/);
    if (m) result.push({ line: i, title: m[1].trim() });
  }
  return result;
}

/**
 * Pass 2: when an H1/H2 chunk is over TOKEN_MAX, attempt to split it
 * along H3 boundaries. Returns the original split unchanged if no H3
 * markers are present (let the upstream warning fire). Sub-chunk
 * titles are prefixed with the parent H2 for context, e.g. the
 * "Connecting to an external system" H3 inside "Usage" becomes
 * "Usage — Connecting to an external system".
 *
 * Preface handling (text between the H2 line and the first H3):
 * - If the preface is below TOKEN_MIN, prepend it to the first
 *   H3 sub-chunk so the H2 intro context isn't lost.
 * - Otherwise emit it as a stand-alone "{H2} — Overview" chunk.
 */
function splitByH3(rawSplit: RawSplit): RawSplit[] {
  const h3s = findH3Boundaries(rawSplit.body);
  if (h3s.length === 0) return [rawSplit];

  const lines = rawSplit.body.split(/\r?\n/);
  const preface = lines.slice(0, h3s[0].line).join("\n").trim();
  const prefaceTokens = estimateTokens(preface);
  const mergePrefaceWithFirst = prefaceTokens < TOKEN_MIN;

  const out: RawSplit[] = [];

  // Emit preface as its own chunk only if it carries enough signal
  // to embed meaningfully. Otherwise it'll ride with the first H3.
  if (preface.length > 0 && !mergePrefaceWithFirst) {
    out.push({
      title: `${rawSplit.title} — Overview`,
      body: preface,
    });
  }

  for (let i = 0; i < h3s.length; i++) {
    const start = h3s[i].line;
    const end = i + 1 < h3s.length ? h3s[i + 1].line : lines.length;
    let body = lines.slice(start, end).join("\n").trim();
    if (i === 0 && mergePrefaceWithFirst && preface.length > 0) {
      body = preface + "\n\n" + body;
    }
    out.push({
      title: `${rawSplit.title} — ${h3s[i].title}`,
      body,
    });
  }

  return out;
}

async function processFile(
  sourcePath: string,
  records: ChunkRecord[],
): Promise<void> {
  const content = await readFile(sourcePath, "utf-8");
  const splits = splitByHeadings(content);

  // If no headings at all, fall back to a single chunk using the filename.
  const fallbackTitle = sourcePath.split(/[\\/]/).pop()!.replace(/\.md$/, "");
  const effective: RawSplit[] = splits.length > 0
    ? splits
    : [{ title: fallbackTitle, body: content.trim() }];

  // Path components for ID + topic/subtopic.
  const rel = toPosix(relative(SOURCE_DIR, sourcePath));
  const relNoExt = rel.replace(/\.md$/, "");
  const segments = relNoExt.split("/");
  const topic = segments[0] ?? "";
  const subtopic = segments[1] ?? "";

  for (const split of effective) {
    // Pass 2: oversized H1/H2? try sub-splitting at H3 boundaries.
    let pieces: RawSplit[] = [split];
    if (estimateTokens(split.body) > TOKEN_MAX) {
      const sub = splitByH3(split);
      if (sub.length > 1) pieces = sub;
    }

    for (const piece of pieces) {
      const tokenEstimate = estimateTokens(piece.body);

      if (tokenEstimate < TOKEN_MIN) {
        console.warn(
          `  ⚠ undersized chunk (${tokenEstimate} tok) in ${rel}: "${piece.title}"`,
        );
      } else if (tokenEstimate > TOKEN_MAX) {
        console.warn(
          `  ⚠ oversized chunk (${tokenEstimate} tok > ${TOKEN_MAX}) in ${rel}: "${piece.title}"`,
        );
      }

      const sectionSlug = slugify(piece.title) || "untitled";
      const id = `${relNoExt}/${sectionSlug}`;
      const filenameSlug = id.replace(/\//g, "-");
      const chunkPath = toPosix(join(CHUNKS_DIR, `${filenameSlug}.md`));

      await writeFile(chunkPath, piece.body, "utf-8");

      records.push({
        id,
        sourcePath: toPosix(sourcePath),
        chunkPath,
        topic,
        subtopic,
        title: piece.title,
        tokenEstimate,
        characterCount: piece.body.length,
      });
    }
  }
}

async function main() {
  console.log("\u{1F43B} Kuma Pack — Chunk\n");

  // Reset build/chunks/
  if (existsSync(CHUNKS_DIR)) {
    await rm(CHUNKS_DIR, { recursive: true, force: true });
  }
  await mkdir(CHUNKS_DIR, { recursive: true });

  console.log("Step 1: Discovering source markdown...");
  const sourceFiles = await walkMarkdown(SOURCE_DIR);
  console.log(`  found ${sourceFiles.length} markdown files\n`);

  console.log("Step 2: Splitting + writing chunks...");
  const records: ChunkRecord[] = [];
  for (const file of sourceFiles) {
    await processFile(file, records);
  }
  console.log(`  produced ${records.length} chunks\n`);

  const totalCharacters = records.reduce((s, r) => s + r.characterCount, 0);
  const totalTokens = records.reduce((s, r) => s + r.tokenEstimate, 0);

  console.log("Step 3: Writing chunks-index.json...");
  const index = {
    version: 1,
    totalChunks: records.length,
    totalCharacters,
    totalTokensEstimate: totalTokens,
    chunks: records,
  };
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
  console.log(`  ${INDEX_PATH}`);
  console.log(`  total chars: ${totalCharacters.toLocaleString()}`);
  console.log(`  total tokens (est): ${totalTokens.toLocaleString()}\n`);

  console.log("✅ Chunk complete!");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
