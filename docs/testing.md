# Testing

The normal check before a PR is:

```bash
npm run gitcheck
npm --prefix frontend audit
```

`gitcheck` runs frontend lint and Jest tests from the root command hub. `npm audit`
should stay at 0 known vulnerabilities.

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

## Local Upload Bypass

For local upload testing without a browser session, set:

```env
UPLOAD_BYPASS_ENABLED=true
UPLOAD_BYPASS_PROFILE_ID=<local test profile uuid>
```

The upload API only honors this bypass outside production. It still validates
the target profile, blocked status, file type, resource metadata, storage, and
moderation/approval rules.

## Production Build

When env vars are available, also run:

```bash
npm --prefix frontend run build
```

This catches route, TypeScript, and production rendering issues that lint and Jest do not cover.

## Dependency Notes

- PDF previews in the browser use `react-pdf`.
- Server-side upload previews use `pdf2pic` and `sharp` to generate a blurred first-page image.
- `pdf2pic` depends on the deprecated `gm` package. Keep it only while the current upload preview behavior is needed; replace that preview renderer before expanding the upload pipeline.
