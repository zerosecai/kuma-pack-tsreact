# Kuma Pack: TypeScript + React + Vite

> Skill pack for [Kuma Code](https://github.com/zerosecai/kuma-code) covering TypeScript, React, and Vite.

## What is this?

A modular knowledge bundle that helps AI coding agents understand TypeScript, React, and Vite better.

Skill packs work by injecting relevant documentation, type definitions, and patterns into the AI's context window — making a small local model perform like a much larger one on TypeScript/React tasks.

## Status

🚧 **Day 1** — Pack format definition + first chunks. Not yet usable.

## Structure

```
source/         Raw curated content (markdown chunks)
scripts/        Build pipeline (chunk → embed → package)
build/          Generated artifacts (gitignored)
manifest.json   Pack metadata
```

## License

MIT — see [LICENSE](LICENSE).

Pack content respects upstream licenses (TypeScript handbook: Apache 2.0, React docs: MIT, etc.). See [ATTRIBUTION.md](ATTRIBUTION.md) once published.
