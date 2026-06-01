# Testing

The normal check before a PR is:

```bash
npm run gitcheck
```

That runs frontend lint and Jest tests from the root command hub.

## Current Coverage

Current Jest tests cover focused helper behavior:

- Course search.
- Department search.
- Class search ranking.
- Nickname generation.
- Leaderboard ranking.
- Profile stats formatting.

## When To Add Tests

Add or update tests when changing:

- Search or ranking behavior.
- Credit math.
- Upload approval rules.
- Profile stats.
- Auth/session recovery.
- Moderation decisions.
- Any shared helper in `frontend/lib` or `frontend/app/api/**/helpers`.

## Manual Smoke Test

For UI or flow changes, also check the app locally:

1. Run `npm run setup`.
2. Sign in with a Cal Poly email.
3. Browse a course.
4. Open a resource preview.
5. Upload a PDF if the change touches uploads.
6. Check mobile width for changed screens.

## Known Gap

`next build` currently fails on a `pdf2pic` TypeScript overload in `frontend/app/api/upload/helpers/preview.ts`. The required PR gate is `npm run gitcheck` until that build issue is fixed.
