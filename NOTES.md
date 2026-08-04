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
- **Backend URL no longer hardcoded.** Frontend reads `VITE_API_URL` from an environment variable instead of hardcoding `127.0.0.1:8000`.
- **Mobile responsiveness fixed.** Comparison grid and page padding now responsive (stacked on narrow screens, side-by-side from 640px up). Tested on iPhone SE and iPad widths.
- **Second input styling fixed.** Now matches the first input's redesigned look.
- **Footer links added.** Privacy modal, Contact (GitHub profile), View Source (this repo), open in new tabs with `rel="noopener noreferrer"`.

## AI Summary Feature (done)

- Groq, Llama 3.3 70B, no card required, no training-data clause, 1,000 req/day free tier.
- Opt-in button, cached per repo in SQLite (24h TTL), 50/day hard cap independent of caching, 150 max_tokens per call.
- Frontend does a simple typewriter reveal on the returned text, no real streaming, just animating the already-complete response.
- Debug print added on Groq API failures so real errors show in the terminal instead of only a generic message reaching the user.

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

## UI Polish (deferred)

- **Empty state for first-time visitors.** Low priority, diminishing returns for this project's actual audience.
- **Deeper accessibility pass** (Escape closing the modal, more aria-labels beyond the two inputs). Worth doing if accessibility becomes something to showcase specifically, not a current gap that's actually blocking anyone.

## Deployment (live)

- **Backend**: Render, Web Service. Root directory `backend`, build command `pip install -r requirements.txt`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check path `/`, auto-deploys on push to `main`. Env vars: `GITHUB_TOKEN`, `GROQ_API_KEY`, `FRONTEND_URL` (set to the Vercel URL below). Live at: https://github-analyzer-ymi5.onrender.com
- **Frontend**: Vercel. Root directory `frontend`, framework auto-detected as Vite. Env var: `VITE_API_URL` set to the Render URL above (baked in at build time, not read live). Auto-deploys on push. Live at: https://github-analyzer-beta-steel.vercel.app
- CORS is configurable via `FRONTEND_URL` env var on the backend (falls back to `localhost:5173` if unset), no hardcoded origin anymore.
- Google Search Console verified via HTML meta tag in `frontend/index.html` (DNS TXT method not available since we're on Vercel's free subdomain, not a custom domain).
- Confirmed working end to end post-deploy: single search, comparison mode, AI summary, and error handling all tested live, not just locally.
- Ephemeral filesystem tradeoff now applies for real: `cache.db` resets on Render redeploys/restarts. Accepted, not a real problem at this scale.
- No custom domain yet, using free `vercel.app` and `onrender.com` subdomains. Revisit if wanted later.

## Performance & Rate Limits

- Fresh (uncached) search: 1 call for repo info, then 4 more in parallel (contributors, languages, commit activity, README) = 5 GitHub calls total. Cached search: 0 calls.
- 5000 requests/hour authenticated, shared across everyone now that it's live.
- **Known limitation: cache rows never expire/delete.** Not a real problem at this scale, worth a periodic cleanup eventually.
- Token expires in 90 days from creation, remember to regenerate.

## Future Scaling (not needed yet, real upgrade path if this grows)

- **Postgres instead of SQLite.** Real, learnable upgrade if we want production-database experience or hit SQLite's concurrent-write limits.
- **GitHub App instead of a personal token.** Rate limits scale with usage instead of one fixed 5000/hour bucket.
- **Redis for hot-repo caching.** Faster than SQLite, overkill at current scale.
- **Edge caching (e.g. Cloudflare)** in front of the API, real technique, not needed yet.

## Security

- **RLS not needed right now.** No user accounts, no private data, the SQLite cache is just public repo info.
- **SQL injection is the real concern.** Always use parameterized queries, never string-format user input into SQL. Already done this way.
- **CORS restricted to the real deployed frontend URL** via `FRONTEND_URL`, no longer hardcoded to localhost.
- **HTTPS confirmed active** on both Vercel and Render (automatic on both).
- Token stays server-side only, never sent to the browser.
- **Verified clean**: `.env` never entered git history, no hardcoded keys anywhere in tracked files, no tokens sent to the browser, error responses never leak internals, `cache.db` properly git-ignored.

## Code Structure

- `main.py` is one file, growing (GitHub logic, caching, health score, AI summary). Split into separate files once it starts feeling cluttered.

## Roadmap

- Automated tests (pytest), makes more sense now that there's stable logic worth testing.
- Update README with live URL, screenshots, and setup instructions.
- Custom domain, if wanted later.