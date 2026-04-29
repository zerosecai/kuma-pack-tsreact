/**
 * Phase 4 Day 1 — Embedding test
 *
 * Validates: bge-small-en-v1.5 can embed our chunks
 * and similarity search returns correct top match.
 */

import { pipeline, env } from "@xenova/transformers";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Disable browser cache; allow remote model downloads on first run.
env.allowRemoteModels = true;
env.useBrowserCache = false;

interface Chunk {
  id: string;
  path: string;
  content: string;
  embedding?: number[];
}

async function loadChunks(sourceDir: string): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".md")) {
        const content = await readFile(fullPath, "utf-8");
        chunks.push({
          id: fullPath
            .replace(sourceDir + "/", "")
            .replace(sourceDir + "\\", "")
            .replace(".md", "")
            .replace(/\\/g, "/"),
          path: fullPath,
          content,
        });
      }
    }
  }

  await walk(sourceDir);
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  console.log("\u{1F43B} Kuma Skill Pack — Embedding Test\n");

  // Step 1: Load model
  console.log("Step 1: Loading bge-small-en-v1.5 (~30MB, first run downloads)...");
  const startLoad = Date.now();
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/bge-small-en-v1.5",
  );
  console.log(`  loaded in ${Date.now() - startLoad}ms\n`);

  // Step 2: Load chunks
  console.log("Step 2: Loading source chunks...");
  const chunks = await loadChunks("source");
  console.log(`  found ${chunks.length} chunks\n`);

  // Step 3: Embed all chunks
  console.log("Step 3: Embedding all chunks...");
  const startEmbed = Date.now();
  for (const chunk of chunks) {
    const output = await extractor(chunk.content, {
      pooling: "mean",
      normalize: true,
    });
    chunk.embedding = Array.from(output.data) as number[];
  }
  const embedTime = Date.now() - startEmbed;
  console.log(
    `  embedded ${chunks.length} chunks in ${embedTime}ms (avg: ${Math.round(
      embedTime / chunks.length,
    )}ms each)`,
  );
  console.log(`  embedding dimensions: ${chunks[0].embedding!.length}\n`);

  // Step 4: Test queries
  const queries = [
    "How do I declare a function in TypeScript?",
    "What is useState in React?",
    "How to define an object type?",
    "useEffect dependency array",
    "string and number types",
  ];

  console.log("Step 4: Testing queries...\n");
  for (const query of queries) {
    const output = await extractor(query, {
      pooling: "mean",
      normalize: true,
    });
    const queryEmbedding = Array.from(output.data) as number[];

    const scored = chunks.map((chunk) => ({
      id: chunk.id,
      score: cosineSimilarity(queryEmbedding, chunk.embedding!),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    console.log(`Query: "${query}"`);
    for (const result of top3) {
      console.log(`  ${result.score.toFixed(4)}  ${result.id}`);
    }
    console.log();
  }

  console.log("✅ Embedding test complete!");
}

main().catch(console.error);
