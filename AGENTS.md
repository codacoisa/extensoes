# Repository Guidelines

## Project Structure & Module Organization

This repository contains independent browser userscripts. Each active extension lives in its own directory:

- `github-tools/` customizes GitHub, with metadata/update information in `github-tools.meta.js`, runtime logic in `github-tools.user.js`, and a Node test file.
- `opensubtitles-brazilian/` prioritizes Brazilian Portuguese subtitles on OpenSubtitles.
- `psa-telegram/` adds Telegram links to PSA pages.
- `arquivo/` contains archived, unsupported scripts; do not add new work there.

The root `README.md` documents the collection. Each active userscript exposes an installable metadata bootstrap and keeps runtime logic in a separate file; there is no shared application or build output directory.

## Build, Test, and Development Commands

There is no package manager or build step. Run commands from the repository root:

```sh
node --check github-tools/github-tools.user.js
node --test github-tools/github-tools.icons.test.mjs
git diff --check
```

The first command checks userscript syntax, the second runs the built-in Node test runner, and the last catches whitespace errors. Install a `.user.js` temporarily in a userscript manager for browser testing.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, single quotes, `const`/`let`, and camelCase for functions and local variables. Use uppercase snake case for module-level constants (for example, `GITHUB_TOOLS_ICON_PATHS`). Keep each script’s metadata header intact and use descriptive `data-*` markers for DOM nodes. Avoid adding dependencies or network-loaded assets unless the extension explicitly requires them.

## Testing Guidelines

Tests use Node’s built-in `node:test` and `node:assert/strict`. Name unit tests `*.test.mjs` and keep pure resolution or parsing logic testable without a browser DOM. For UI changes, manually check the relevant site in light and dark themes, both the root and nested routes, reload/Turbo navigation, and idempotence (no duplicate injected elements).

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style subjects with an extension scope, such as `fix(github-tools): align file icons` or `feat(psa-telegram): add Telegram action`. Pull requests should explain the affected extension, behavior change, and validation commands. Include screenshots or a short screen recording for visible UI changes, and keep unrelated extensions out of the same change.
