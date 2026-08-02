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

## Legal / Disclaimer

- Not legal advice, just the practical plan. Currently low risk: no accounts, no cookies, no data collection.
- Gets more relevant if we add analytics, cookies, accounts, or logging of AI requests.
- Plan: short disclaimer/footer once deployed, educational project, pulls public GitHub data live, not affiliated with GitHub, no stored visitor data, provided as-is.
- Worth skimming GitHub's API Terms of Service before going live.
- Get real legal advice if this ever gets real traffic or money involved.

## Planned: AI Summary Feature

- Opt-in only, a "Generate AI Summary" button, not automatic on every search.
- Cache summaries per repo in SQLite, same idea as the main caching plan.
- Hard daily cap on total AI generations, independent of caching.
- Low `max_tokens` limit per call.
- Set an actual spending cap on the API key in the provider's console, real safety net beyond our own code.
- **Model not decided yet.** Compared per-token pricing: GPT-5 nano ($0.05/$0.40 per million), Gemini 3.1 Flash-Lite ($0.25/$1.50), Gemini 2.5 Flash ($0.30/$2.50), Claude Haiku 4.5 ($1.00/$5.00). Haiku isn't the cheapest for a task this simple, but at our scale the dollar difference is basically nothing. Decide on ease of integration when we build it, not price. DeepSeek is cheapest overall but has different data/privacy terms, worth weighing given our privacy stance above.

## Deployment

- Local `uvicorn`/`npm run dev` are dev-only. Once deployed: frontend on Vercel, backend on Render/Railway, both run independently of whether the local machine is on.
- Free tiers may spin down the backend after inactivity, slower first response (10-30 sec) after idle. Still reachable, just slower once in a while. Normal for free tiers.
- Could deploy a basic version earlier than Phase 7 if we want it live/shareable sooner. Optional.

## Code Structure

- `main.py` is one file, growing. Split into separate files (routes, GitHub logic, scoring logic) once it starts feeling cluttered, worth considering soon given its current size.

## Roadmap

- Automated tests (pytest), makes more sense now that there's stable logic worth testing (health score formula, caching behavior).