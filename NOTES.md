# Project Notes

Running list of known issues, planned improvements, and decisions. Not all of this needs fixing immediately, this is a working log.

## Fixed

- **Contributor count was wrong for popular repos.** Fixed by properly parsing the `Link` pagination header using `urllib.parse` instead of naive string splitting, which broke because `per_page` contains the substring `page=`.
- **Language breakdown wasn't displayed.** Backend already fetched full language byte-counts, frontend only showed the single primary language. Added a percentage breakdown component.
- **No loading/error feedback on frontend.** Added loading state (button disables and shows "Analyzing...") and visible error messages (instead of silent console logs) when a repo isn't found or the request fails.
- **URL parsing was too strict.** Now handles missing protocol, trailing slashes, extra path segments (e.g. `/tree/main`), bare `owner/repo` input, and is case-insensitive.

## Performance

- `/analyze/{owner}/{repo}` makes 4 sequential requests to GitHub (repo info, contributors, languages, commit activity), one after another. This makes the endpoint noticeably slow (1-2+ seconds). Could be sped up later using async/concurrent requests, a more advanced technique than what we've covered so far.
- No caching yet. Every search re-fetches everything from GitHub, even for repos just searched seconds ago. Planned fix: SQLite caching in Phase 6.

## Rate Limits

- Authenticated limit is 5000 requests/hour. At 4 calls per search, that's roughly 1250 searches/hour, shared across all users once this is live, not per-visitor.
- Caching is the main fix for this, should be prioritized in Phase 6 over other features.
- Token expires in 90 days from creation (set up in Phase 4). Remember to regenerate before it expires.

## Security & Deployment Readiness (before Phase 7 goes live)

- **Not urgent while running locally.** Backend only listens on 127.0.0.1, not reachable from outside this machine. These items matter once there's a public URL.
- **Rate-limit our own API endpoints.** Right now, anyone hitting a deployed `/analyze/...` could burn through our shared GitHub token's rate limit. Add per-IP or per-timeframe limiting before going public.
- **Restrict CORS to the real deployed frontend URL**, not just localhost, once deployed.
- **Confirm HTTPS is active** on both deployed frontend and backend (usually automatic on platforms like Vercel/Render, but worth verifying).
- **Token stays server-side only.** Already done correctly, GITHUB_TOKEN lives only in backend `.env`, never sent to the browser. Keep it this way.

## Coming Up Soon (not bugs, just not built yet)

- Consider moving a basic deployment earlier than Phase 7, so the project is visible/shareable sooner, optional.

## Structural / Extensibility

- `main.py` is currently one file. Fine for now, but as more endpoints and logic get added, this should be split into separate files (e.g. routes, GitHub API logic, scoring logic).

## Not Built Yet (lower priority)

- Automated tests (pytest). Makes more sense once there's stable logic worth testing, like the health score formula in Phase 6.