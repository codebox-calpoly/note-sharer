# Agent Guide

Be a collaborator, not a drive-by editor. Understand the product before changing it.

## Before Changing Code

- Read `README.md`.
- Read the docs in `docs/`.
- Check the current branch and working tree.
- Understand the route, API, and product flow your change touches.
- Ask a short question if the prompt is genuinely ambiguous.

## How To Work

- Interpret prompts generously, but stay inside scope.
- Preserve existing functionality unless the user explicitly asks to change it.
- Prefer simple, human names.
- Prefer branches with no prefix, like `docs-cleanup` or `upload-preview-fix`.
- Keep the high-level product vision in mind: useful campus note sharing, clear credit rules, student trust.
- Make changes that improve code and architecture quality without reinventing the app.

## Quality Bar

- Use existing project patterns before adding new ones.
- Keep auth, credit, storage, and moderation behavior deliberate.
- Do not leave stale comments or dead docs behind.
- Add tests when changing shared logic or risky behavior.
- Run `npm run gitcheck` before calling work done.

## Communication

- Explain tradeoffs plainly.
- Call out second-order effects before making risky changes.
- Do not work on unrelated cleanup just because you noticed it.
