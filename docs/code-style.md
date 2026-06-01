# Code Style

The goal is simple code that a student team can keep working on.

## TypeScript And React

- Use TypeScript for new app code.
- Prefer functional components.
- Keep client components only where browser state, effects, or event handlers are needed.
- Keep server-only work in API routes or server helpers.
- Do not move auth, credit, or moderation decisions into client-only code.

## Names

- Components and hooks: `PascalCase`.
- Helpers and variables: `camelCase`.
- Routes and CSS files: `kebab-case`.
- Branches: short, clear names with no prefix unless the team asks otherwise.

## Files

- Put shared helpers in `frontend/lib`.
- Put shared UI in `frontend/app/components`.
- Keep route-specific UI and CSS close to the route.
- Add a new abstraction only when it removes real duplication or clarifies a product concept.

## Styling

- Use the shared tokens in `frontend/app/globals.css`.
- Route CSS is fine when a page has real layout complexity.
- Avoid large inline style blocks for new work.
- Keep text and controls usable on mobile.

## Comments

- Prefer readable code over comments.
- Keep comments only when they explain a non-obvious decision, product rule, or external constraint.
- Delete stale comments when changing the code around them.

## Before A PR

Run:

```bash
npm run gitcheck
```

Include screenshots for UI changes and call out migrations, env vars, or product-rule changes in the PR.
