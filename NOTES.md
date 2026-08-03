# Project Notes

Running list of known issues, planned improvements, and decisions.

## Fixed

- **Contributor count was wrong for popular repos.** GitHub paginates the `/contributors` endpoint (30 per page). Fixed by parsing the `Link` header properly with `urllib.parse` instead of naive string splitting (which broke on `per_page` containing the substring `page=`).
- **Language breakdown wasn't displayed.** Backend already had the byte-count data, frontend only showed the primary language. Added a real percentage breakdown.
- **No loading/error feedback on frontend.** Added a loading state and visible error messages instead of silent console logs.
- **URL parsing was too strict.** Now handles missing protocol, trailing slashes, extra path segments, bare `owner/repo`, and is case-insensitive.
- **Commit activity chart added.** Line chart with Year/Month/Week toggle, using commit_activity's weekly totals plus each week's daily breakdown.
- **SQLite caching added.** Analyzed repo data is stored with a timestamp and served from cache if recent (1 hour TTL), only hits GitHub again if stale. Fixed both speed and rate-limit exposure on repeat searches. Response includes `cached: true/false` and `cache_age_seconds` so the frontend can show freshness.
- **Sequential GitHub calls made concurrent.** Switched from `requests` to `httpx` + `asyncio.gather`. Repo info still fetches first (need the 404 check before anything else), but contributors, languages, commit activity, and the README check now run in parallel. Noticeably faster on cache misses.
- **Rate limiting added on our own API.** `slowapi`, 10 requests/minute per IP on `/analyze`. Protects the shared GitHub token from being drained by a bot or a loop. Returns a clear "Too many requests" message on the frontend instead of a generic error.
- **Health score and repo comparison built.** Health score formula (activity/contributors/documentation/issues out of 100). Comparison mode fetches two repos in parallel with `Promise.allSettled`, shows them side by side, highlights whichever wins each metric.
- **Backend URL no longer hardcoded.** Frontend reads `VITE_API_URL` from an environment variable instead of hardcoding `127.0.0.1:8000`. Set in `frontend/.env` locally, will be set in Vercel's dashboard at deploy time. `.env.example` documents it.

## AI Summary Feature (done)

- Groq, Llama 3.3 70B, no card required, no training-data clause, 1,000 req/day free tier.
- Opt-in button, cached per repo in SQLite (24h TTL), 50/day hard cap independent of caching, 150 max_tokens per call.
- Frontend does a simple typewriter reveal on the returned text, no real streaming, just animating the already-complete response.
- Debug print added on Groq API failures (`print(f"Groq API error..."`) so real errors show in the terminal instead of only a generic message reaching the user.

## Privacy Notice (done)

- Implemented as a footer link ("Privacy") that opens a modal on the site, plus a standalone `PRIVACY.md` in the repo root, same text in both places.
- Known small maintenance note: the two copies aren't linked, if the text ever changes, both need updating manually.
- Covers: no accounts/cookies/tracking, IP used transiently for our own rate limiting, hosting provider's own standard access logging, and that repo data may be sent to Groq if the AI summary is used.

## Design & UI (done)

- Moved off default Tailwind styling to a real token system: JetBrains Mono for data/headers, Manrope for body text, defined via Tailwind v4's `@theme` in `index.css`.
- Color tokens: brand violet-indigo (`#6c5ce7`), diff-green/diff-red pair (`#16a34a` / `#ef4444`) used consistently for win/loss and health signals, tying back to git's own diff language.
- Health score bars rebuilt as segmented diff-stat-style bars (flex div segments, not text characters, so they actually stretch to fill the row) instead of generic progress bars.
- Cursor fix: all buttons now show a pointer cursor (browsers don't do this by default for `<button>`, only `<a>`), disabled buttons show not-allowed.
- Footer fixed to anchor at the bottom of the viewport on short pages (flex column layout) instead of floating awkwardly under sparse content.

## Performance & Rate Limits

- Fresh (uncached) search: 1 call for repo info, then 4 more in parallel (contributors, languages, commit activity, README) = 5 GitHub calls total. Cached search: 0 calls.
- 5000 requests/hour authenticated, shared across everyone once deployed. Caching means this is really only a concern for the *first* search of any given repo, not repeat traffic.
- **Known limitation: cache rows never expire/delete.** `repo_cache` grows forever. Not a real problem at this scale, worth a periodic cleanup eventually (delete rows older than some threshold).
- Token expires in 90 days from creation, remember to regenerate.

## Future Scaling (not needed yet, real upgrade path if this grows)

- **Postgres instead of SQLite.** Not a current bottleneck, but a real, learnable upgrade if we want production-database experience or actually hit SQLite's concurrent-write limits.
- **GitHub App instead of a personal token.** Rate limits scale with usage instead of one fixed 5000/hour bucket. Only worth the setup complexity if we're regularly hitting the ceiling, not there yet.
- **Redis for hot-repo caching.** Faster than SQLite for frequently-requested repos. Real production pattern, overkill at current scale.
- **Edge caching (e.g. Cloudflare)** in front of the API, catches repeat requests before they even reach the backend. Same story, real technique, not needed yet.

## Security

- **RLS not needed right now.** No user accounts, no private data, the SQLite cache is just public repo info. Revisit if accounts/saved searches get added.
- **SQL injection is the real concern.** Owner/repo values come from user input and get used in SQLite queries. Always use parameterized queries, never string-format user input into SQL. Already done this way.
- **Restrict CORS to the real deployed frontend URL**, not localhost, once live.
- **Confirm HTTPS is on** for both deployed frontend and backend (usually automatic on Vercel/Render, worth checking).
- Token stays server-side only (`.env`, never sent to the browser). Keep it that way.
- **Verified clean**: `.env` never entered git history (`git log --all -- backend/.env` returns nothing), no hardcoded keys anywhere in tracked files (`git grep` for both key prefixes returns nothing), no tokens sent to the browser (checked Network tab directly), error responses never leak tracebacks/internals, `cache.db` properly git-ignored.

## Deployment

- Local `uvicorn`/`npm run dev` are dev-only. Once deployed: frontend on Vercel, backend on Render/Railway, both run independently of whether the local machine is on.
- Free tiers may spin down the backend after inactivity, slower first response (10-30 sec) after idle. Still reachable, just slower once in a while. Normal for free tiers.
- **Decided**: accepting that Render's free tier has an ephemeral filesystem, `cache.db` resets on redeploys/restarts. Not treating this as a problem, worst case is a slightly slower first fetch (and that's already fast now thanks to concurrent calls), not a correctness issue. Revisit only if this ever gets heavy sustained traffic.
- Code is genuinely deployment-ready: hardcoded URLs removed, secrets handled via env vars on both ends, CORS/URL updates are the only things left to change at actual deploy time.
- Could deploy a basic version earlier than Phase 7 if we want it live/shareable sooner. Optional.

## Code Structure

- `main.py` is one file, growing (now includes GitHub logic, caching, health score, and AI summary). Split into separate files (routes, GitHub logic, scoring logic) once it starts feeling cluttered, worth considering soon given its current size.

## Roadmap

- Automated tests (pytest), makes more sense now that there's stable logic worth testing (health score formula, caching behavior).