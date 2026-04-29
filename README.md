# Kuma Pack: TypeScript + React + Vite

[![Website](https://img.shields.io/badge/Website-zerosec--ai.com-00E5FF?style=flat-square)](https://zerosec-ai.com)
[![License](https://img.shields.io/badge/License-MIT-00E5FF?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-M1%20Complete-FFB300?style=flat-square)](#)
[![Parent](https://img.shields.io/badge/Parent-Kuma%20Code-7C4DFF?style=flat-square)](https://github.com/zerosecai/kuma-code)

> Skill pack for [Kuma Code](https://github.com/zerosecai/kuma-code) covering TypeScript, React, and Vite.

## What is this?

A modular knowledge bundle that helps AI coding agents understand TypeScript, React, and Vite better.

Skill packs work by injecting relevant documentation, type definitions, and patterns into the AI's context window — making a small local model perform like a much larger one on TypeScript/React tasks.

## Status

🚧 **Day 2 — M1 (build pipeline) complete.** Currently 9 sample chunks. Day 3-7: scaling content to ~1 GB. Not yet wired into Kuma extension.

| Milestone | Status |
|-----------|--------|
| M1: Build pipeline (chunk → embed → index → package) | ✅ Done |
| M2: Content scaling (~1 GB) | ⬜ In progress |
| M3: Extension integration | ⬜ Pending |
| M4: Quality benchmarks | ⬜ Pending |

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
