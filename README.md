# Kuma Pack: TypeScript + React + Vite

[![Website](https://img.shields.io/badge/Website-zerosec--ai.com-00E5FF?style=flat-square)](https://zerosec-ai.com)
[![License](https://img.shields.io/badge/License-MIT-00E5FF?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-M1%20Done%20%2B%20M2%20Partial-FFB300?style=flat-square)](#)
[![Chunks](https://img.shields.io/badge/Chunks-216-7C4DFF?style=flat-square)](#)
[![Parent](https://img.shields.io/badge/Parent-Kuma%20Code-7C4DFF?style=flat-square)](https://github.com/zerosecai/kuma-code)

> Skill pack for [Kuma Code](https://github.com/zerosecai/kuma-code) covering TypeScript, React, and Vite.

## What is this?

A modular knowledge bundle that helps AI coding agents understand TypeScript, React, and Vite better.

Skill packs work by injecting relevant documentation, type definitions, and patterns into the AI's context window — making a small local model perform like a much larger one on TypeScript/React tasks.

## Status

🟢 **Day 4 — M1 complete + M2 partial.** Currently 216 chunks from real TypeScript / React / Vite docs. Not yet wired into Kuma extension.

Latest: [v0.1.0-alpha](https://github.com/zerosecai/kuma-pack-tsreact/releases/tag/v0.1.0-alpha)

| Milestone | Status | Detail |
|-----------|--------|--------|
| M1: Build pipeline | ✅ Done | chunk → embed → index → package |
| M2: Content scaling | 🟡 Partial | 216 chunks (target: ~1 GB) |
| M3: Extension integration | ⬜ Pending | Week 5-6 |
| M4: Quality + benchmarks | ⬜ Pending | Week 7-8 |

### Latest stats

- **Chunks:** 216 (TypeScript: 73, React: 59, Vite: 84)
- **Pack size:** 981 KB packed (2.2 MB raw)
- **Embedding model:** bge-small-en-v1.5 (384 dims, ~30 MB)
- **Build time:** ~10s end-to-end
- **Semantic search:** 5/5 test queries → correct top match

## Build

```bash
bun install
bun run build    # chunk → embed → index → package
# → dist/kuma-pack-tsreact-<version>.kpack
```

Pipeline scripts:

- `chunk.ts` — split markdown by H1/H2 → atomic chunks
- `embed.ts` — generate 384-dim vectors via bge-small-en-v1.5
- `index.ts` — build 2-level TOC (topic → subtopic → chunks)
- `package.ts` — ZIP build artifacts → `.kpack` archive

## Structure

```
source/         Raw curated content (markdown chunks)
scripts/        Build pipeline (chunk → embed → index → package)
build/          Generated artifacts (gitignored)
dist/           Packaged .kpack output (gitignored)
manifest.json   Pack metadata
```

## License

MIT — see [LICENSE](LICENSE).

Pack content respects upstream licenses (TypeScript handbook: Apache 2.0, React docs: MIT, etc.).
