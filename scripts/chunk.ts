/**
 * Phase 4 Day 2 — Chunker
 *
 * Walks source/, splits each .md file at H1/H2 boundaries,
 * writes atomic chunks to build/chunks/ and an index to
 * build/chunks-index.json.
 *
 * Why these limits:
 * - bge-small-en-v1.5 has a 512-token max input. We target 1000 tokens
 *   on disk because the model truncates, but downstream consumers may
 *   re-chunk with overlap. The min/max here are about embedding signal,
 *   not model limits.
 * - chars / 4 is the standard rough token estimate for English prose;
 *   close enough for budgeting without pulling in a tokenizer dep.
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
    const tokenEstimate = estimateTokens(split.body);

    if (tokenEstimate < TOKEN_MIN) {
      console.warn(
        `  ⚠ undersized chunk (${tokenEstimate} tok) in ${rel}: "${split.title}"`,
      );
    } else if (tokenEstimate > TOKEN_MAX) {
      console.warn(
        `  ⚠ oversized chunk (${tokenEstimate} tok > ${TOKEN_MAX}) in ${rel}: "${split.title}"`,
      );
    }

    const sectionSlug = slugify(split.title) || "untitled";
    const id = `${relNoExt}/${sectionSlug}`;
    const filenameSlug = id.replace(/\//g, "-");
    const chunkPath = toPosix(join(CHUNKS_DIR, `${filenameSlug}.md`));

    await writeFile(chunkPath, split.body, "utf-8");

    records.push({
      id,
      sourcePath: toPosix(sourcePath),
      chunkPath,
      topic,
      subtopic,
      title: split.title,
      tokenEstimate,
      characterCount: split.body.length,
    });
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
