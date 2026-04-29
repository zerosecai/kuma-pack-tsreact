/**
 * Phase 4 Day 2 — Embedder
 *
 * Reads build/chunks-index.json, embeds each chunk via bge-small-en-v1.5,
 * writes build/embeddings.json (Day 2-7 stays JSON for debugging; will
 * switch to a binary format once stable).
 */

import { pipeline, env } from "@xenova/transformers";
import { readFile, writeFile } from "node:fs/promises";

env.allowRemoteModels = true;
env.useBrowserCache = false;

const MODEL_ID = "Xenova/bge-small-en-v1.5";
const INDEX_PATH = "build/chunks-index.json";
const EMBEDDINGS_PATH = "build/embeddings.json";

interface ChunkRecord {
  id: string;
  chunkPath: string;
  // (more fields exist; we only need these here)
}

interface ChunksIndex {
  version: number;
  totalChunks: number;
  chunks: ChunkRecord[];
}

interface Embedding {
  chunkId: string;
  vector: number[];
}

async function main() {
  console.log("\u{1F43B} Kuma Pack — Embed\n");

  console.log("Step 1: Loading model...");
  const startLoad = Date.now();
  const extractor = await pipeline("feature-extraction", MODEL_ID);
  console.log(`  loaded in ${Date.now() - startLoad}ms\n`);

  console.log("Step 2: Reading chunks index...");
  const indexRaw = await readFile(INDEX_PATH, "utf-8");
  const index: ChunksIndex = JSON.parse(indexRaw);
  console.log(`  ${index.totalChunks} chunks to embed\n`);

  console.log("Step 3: Embedding chunks...");
  const startEmbed = Date.now();
  const embeddings: Embedding[] = [];
  let dimensions = 0;

  for (let i = 0; i < index.chunks.length; i++) {
    const chunk = index.chunks[i];
    const content = await readFile(chunk.chunkPath, "utf-8");
    const output = await extractor(content, {
      pooling: "mean",
      normalize: true,
    });
    const vector = Array.from(output.data) as number[];
    if (dimensions === 0) dimensions = vector.length;

    embeddings.push({ chunkId: chunk.id, vector });

    if ((i + 1) % 10 === 0 || i + 1 === index.chunks.length) {
      console.log(`  ${i + 1}/${index.chunks.length} embedded`);
    }
  }
  const embedMs = Date.now() - startEmbed;
  console.log(
    `  done in ${(embedMs / 1000).toFixed(1)}s (avg ${Math.round(
      embedMs / index.chunks.length,
    )}ms/chunk, ${dimensions} dims)\n`,
  );

  console.log("Step 4: Writing embeddings.json...");
  const out = {
    version: 1,
    model: MODEL_ID,
    dimensions,
    totalChunks: embeddings.length,
    embeddingTime: `${(embedMs / 1000).toFixed(1)}s`,
    embeddings,
  };
  await writeFile(EMBEDDINGS_PATH, JSON.stringify(out), "utf-8");
  console.log(`  ${EMBEDDINGS_PATH}\n`);

  console.log("✅ Embed complete!");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
