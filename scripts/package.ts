/**
 * Phase 4 Day 2 — Packager
 *
 * Bundles build/ artifacts + an updated manifest.json into a ZIP-format
 * .kpack archive at dist/<name>-<version>.kpack, then writes a sibling
 * .sha256 file.
 *
 * Layout inside the .kpack:
 *   manifest.json            (root manifest with stats updated)
 *   toc.json                 (from build/)
 *   chunks-index.json        (from build/)
 *   embeddings.json          (from build/)
 *   chunks/                  (build/chunks/*.md)
 */

import {
  createReadStream,
  createWriteStream,
  existsSync,
  statSync,
} from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import archiver from "archiver";

const MANIFEST_SRC = "manifest.json";
const BUILD_DIR = "build";
const DIST_DIR = "dist";

interface Manifest {
  id: string;
  name: string;
  version: string;
  stats: {
    totalChunks: number;
    totalSize: string;
    buildDate: string | null;
  };
  [k: string]: unknown;
}

interface ChunksIndex {
  totalChunks: number;
  totalCharacters: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function sha256OfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function main() {
  console.log("\u{1F43B} Kuma Pack — Package\n");

  // Read manifest + chunks-index for stats.
  console.log("Step 1: Reading manifest + build artifacts...");
  const manifest: Manifest = JSON.parse(await readFile(MANIFEST_SRC, "utf-8"));
  const chunksIndex: ChunksIndex = JSON.parse(
    await readFile(join(BUILD_DIR, "chunks-index.json"), "utf-8"),
  );

  // Compute total uncompressed size = sum of all build artifacts that go in.
  const required = ["chunks-index.json", "embeddings.json", "toc.json"];
  for (const f of required) {
    if (!existsSync(join(BUILD_DIR, f))) {
      throw new Error(`Missing required artifact: ${join(BUILD_DIR, f)}`);
    }
  }

  let totalUncompressed = 0;
  for (const f of required) {
    totalUncompressed += statSync(join(BUILD_DIR, f)).size;
  }
  const chunkFiles = await readdir(join(BUILD_DIR, "chunks"));
  for (const cf of chunkFiles) {
    totalUncompressed += statSync(join(BUILD_DIR, "chunks", cf)).size;
  }

  // Update manifest with build stats.
  const updatedManifest: Manifest = {
    ...manifest,
    stats: {
      totalChunks: chunksIndex.totalChunks,
      totalSize: formatBytes(totalUncompressed),
      buildDate: new Date().toISOString(),
    },
  };
  console.log(
    `  ${chunksIndex.totalChunks} chunks, ${formatBytes(totalUncompressed)} uncompressed\n`,
  );

  // Ensure dist/.
  if (!existsSync(DIST_DIR)) await mkdir(DIST_DIR, { recursive: true });

  const baseName = `${manifest.id ? `kuma-pack-${manifest.id}` : "kuma-pack"}-${manifest.version}`;
  const kpackPath = join(DIST_DIR, `${baseName}.kpack`);
  const shaPath = `${kpackPath}.sha256`;

  // Build the archive.
  console.log("Step 2: Writing archive...");
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(kpackPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") console.warn(`  warn: ${err.message}`);
      else reject(err);
    });
    archive.on("error", reject);
    archive.pipe(output);

    // Manifest with updated stats (in-memory, not on disk).
    archive.append(JSON.stringify(updatedManifest, null, 2) + "\n", {
      name: "manifest.json",
    });

    // Three JSON artifacts from build/.
    archive.file(join(BUILD_DIR, "toc.json"), { name: "toc.json" });
    archive.file(join(BUILD_DIR, "chunks-index.json"), {
      name: "chunks-index.json",
    });
    archive.file(join(BUILD_DIR, "embeddings.json"), {
      name: "embeddings.json",
    });

    // chunks/ directory.
    archive.directory(join(BUILD_DIR, "chunks"), "chunks");

    archive.finalize();
  });

  const kpackSize = statSync(kpackPath).size;
  console.log(`  ${kpackPath} (${formatBytes(kpackSize)})\n`);

  console.log("Step 3: Computing SHA-256...");
  const sha = await sha256OfFile(kpackPath);
  await Bun.write(shaPath, `${sha}  ${baseName}.kpack\n`);
  console.log(`  ${sha}\n`);

  // Final summary.
  console.log("┌──────────────────────────────────────────────────────────────");
  console.log(`│ pack:       ${baseName}.kpack`);
  console.log(`│ chunks:     ${chunksIndex.totalChunks}`);
  console.log(`│ raw size:   ${formatBytes(totalUncompressed)}`);
  console.log(`│ packed:     ${formatBytes(kpackSize)}`);
  console.log(`│ sha-256:    ${sha}`);
  console.log(`│ output:     ${kpackPath}`);
  console.log("└──────────────────────────────────────────────────────────────");

  console.log("\n✅ Package complete!");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
