# Project Notes

Running list of known issues, planned improvements, and decisions. Not all of this needs fixing immediately, this is a working log.

## Fixed

- **Contributor count was wrong for popular repos.** Fixed by properly parsing the `Link` pagination header using `urllib.parse` instead of naive string splitting, which broke because `per_page` contains the substring `page=`.
- **Language breakdown wasn't displayed.** Backend already fetched full language byte-counts, frontend only showed the single primary language. Added a percentage breakdown component.
- **No loading/error feedback on frontend.** Added loading state (button disables and shows "Analyzing...") and visible error messages (instead of silent console logs) when a repo isn't found or the request fails.
- **URL parsing was too strict.** Now handles missing protocol, trailing slashes, extra path segments (e.g. `/tree/main`), bare `owner/repo` input, and is case-insensitive.
- **Commit activity chart added.** Line chart with Year/Month/Week toggle, using GitHub's weekly commit_activity data (and each week's daily `days` array for the Month/Week views).

## Performance

- `/analyze/{owner}/{repo}` makes 4 sequential requests to GitHub (repo info, contributors, languages, commit activity), one after another. This makes the endpoint noticeably slow (1-2+ seconds). Could be sped up later using async/concurrent requests, a more advanced technique than what we've covered so far.
- No caching yet. Every search re-fetches everything from GitHub, even for repos just searched seconds ago. Planned fix: SQLite caching in Phase 6.

## Rate Limits

- Authenticated limit is 5000 requests/hour. At 4 calls per search, that's roughly 1250 searches/hour, shared across all users once this is live, not per-visitor.
- Caching is the main fix for this, should be prioritized in Phase 6 over other features.
- Token expires in 90 days from creation (set up in Phase 4). Remember to regenerate before it expires.

## Database Design Decisions

- **Row-level security is not needed at this stage.** RLS restricts which database rows a specific user can see, but this project has no user accounts and no private per-user data. The planned SQLite cache only stores public GitHub repo data. Revisit if user accounts, saved searches, or comparison history are ever added.
- **SQL injection is the real concern instead.** When building the SQLite caching layer (Phase 6), owner/repo values come from user input. Must use parameterized queries, never raw string formatting, when building any SQL that includes user input.

## Planned: AI Summary Feature (Phase 6, cost-controlled design)

- **Model**: Claude Haiku 4.5, cheapest current Claude model, well-suited to short factual summaries. Verify current pricing at docs.claude.com before implementing, rates can change.
- **Cache summaries per repo** in SQLite. Repeat searches for the same repo reuse the cached summary instead of calling the AI again.
- **Opt-in only.** A separate "Generate AI Summary" button, not run automatically on every search, so it only costs money when explicitly requested.
- **Hard daily cap** on total AI generations (server-side counter), independent of caching, to bound worst-case cost regardless of traffic.
- **Low `max_tokens` limit** on the API call to cap the cost of any single request.
- **Set an actual spending limit on the API key in the Anthropic Console**, a real account-level safety net beyond our own code.

## Deployment Notes

- Local `uvicorn` / `npm run dev` are dev-only. Once deployed (Phase 7): frontend on Vercel, backend on Render/Railway, both run continuously on their servers, independent of whether the local machine is on.
- Free hosting tiers may "spin down" the backend after a period of inactivity, causing a slower first response (10-30 sec) after idle periods. Site is still reachable, just slower on the first request. A known tradeoff of free tiers, not a bug.

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