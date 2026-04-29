/**
 * Phase 4 Day 2 — TOC builder
 *
 * Reads build/chunks-index.json, groups chunks by (topic, subtopic),
 * writes build/toc.json. This is the 2-level table of contents the
 * runtime uses for fast scoping before the embedding lookup.
 */

import { readFile, writeFile } from "node:fs/promises";

const INDEX_PATH = "build/chunks-index.json";
const TOC_PATH = "build/toc.json";

interface ChunkRecord {
  id: string;
  topic: string;
  subtopic: string;
  title: string;
  // (other fields ignored)
}

interface ChunksIndex {
  version: number;
  totalChunks: number;
  chunks: ChunkRecord[];
}

interface SubtopicNode {
  name: string;
  chunkCount: number;
  chunks: string[];
}

interface TopicNode {
  name: string;
  chunkCount: number;
  subtopics: Record<string, SubtopicNode>;
}

interface Toc {
  version: number;
  totalTopics: number;
  totalSubtopics: number;
  totalChunks: number;
  topics: Record<string, TopicNode>;
}

function prettify(slug: string): string {
  if (!slug) return "";
  // "vite" -> "Vite", "kilo-code" -> "Kilo Code", "i18n" -> "I18n"
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  console.log("\u{1F43B} Kuma Pack — Index (TOC)\n");

  console.log("Step 1: Reading chunks-index.json...");
  const indexRaw = await readFile(INDEX_PATH, "utf-8");
  const index: ChunksIndex = JSON.parse(indexRaw);
  console.log(`  ${index.totalChunks} chunks to organize\n`);

  console.log("Step 2: Grouping by topic/subtopic...");
  const topics: Record<string, TopicNode> = {};

  for (const chunk of index.chunks) {
    const topicKey = chunk.topic || "_uncategorized";
    const subtopicKey = chunk.subtopic || "_root";

    if (!topics[topicKey]) {
      topics[topicKey] = {
        name: prettify(topicKey),
        chunkCount: 0,
        subtopics: {},
      };
    }
    const topic = topics[topicKey];

    if (!topic.subtopics[subtopicKey]) {
      topic.subtopics[subtopicKey] = {
        name: prettify(subtopicKey),
        chunkCount: 0,
        chunks: [],
      };
    }
    const subtopic = topic.subtopics[subtopicKey];

    subtopic.chunks.push(chunk.id);
    subtopic.chunkCount++;
    topic.chunkCount++;
  }

  const totalTopics = Object.keys(topics).length;
  const totalSubtopics = Object.values(topics).reduce(
    (sum, t) => sum + Object.keys(t.subtopics).length,
    0,
  );
  console.log(`  topics: ${totalTopics}, subtopics: ${totalSubtopics}\n`);

  console.log("Step 3: Writing toc.json...");
  const toc: Toc = {
    version: 1,
    totalTopics,
    totalSubtopics,
    totalChunks: index.totalChunks,
    topics,
  };
  await writeFile(TOC_PATH, JSON.stringify(toc, null, 2), "utf-8");
  console.log(`  ${TOC_PATH}\n`);

  // Pretty-print summary tree.
  console.log("Topic tree:");
  for (const [tKey, topic] of Object.entries(topics)) {
    console.log(`  ${tKey} (${topic.chunkCount})`);
    for (const [sKey, sub] of Object.entries(topic.subtopics)) {
      console.log(`    ${sKey} (${sub.chunkCount})`);
    }
  }

  console.log("\n✅ Index complete!");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
