# Project Notes

Running list of known issues, planned improvements, and decisions.

## Fixed

- **Contributor count was wrong for popular repos.** GitHub paginates the `/contributors` endpoint (30 per page). Fixed by parsing the `Link` header properly with `urllib.parse` instead of naive string splitting (which broke on `per_page` containing the substring `page=`).
- **Language breakdown wasn't displayed.** Backend already had the byte-count data, frontend only showed the primary language. Added a real percentage breakdown.
- **No loading/error feedback on frontend.** Added a loading state and visible error messages instead of silent console logs.
- **URL parsing was too strict.** Now handles missing protocol, trailing slashes, extra path segments, bare `owner/repo`, and is case-insensitive.
- **Commit activity chart added.** Line chart with Year/Month/Week toggle, using commit_activity's weekly totals plus each week's daily breakdown.

## Performance & Rate Limits

- `/analyze/{owner}/{repo}` makes 4 sequential GitHub API calls per search (repo info, contributors, languages, commit activity). Slow (1-2+ sec) and burns through the rate limit fast.
- 5000 requests/hour authenticated. At 4 calls/search that's ~1250 searches/hour, shared across everyone once deployed.
- **Fix, top priority for Phase 6: SQLite caching.** Store analyzed repo data with a timestamp, serve from cache if recent, only hit GitHub again if stale. Fixes both the speed and the rate limit exposure at once.
- Could also speed things up later with concurrent/async requests instead of sequential, more advanced, lower priority than caching.
- Token expires in 90 days from creation, remember to regenerate.
- **Known limitation: cache rows never expire/delete.** `repo_cache` grows forever, every unique repo searched stays in there permanently. Not a real problem at this scale (SQLite handles many thousands of rows fine), but worth fixing eventually, e.g. a periodic cleanup deleting rows older than some threshold.
- **Cache status flag added.** Response includes `cached: true/false` and `cache_age_seconds`, frontend can use this to show whether data is fresh or served from cache.


## Security

- **RLS not needed right now.** No user accounts, no private data, the SQLite cache is just public repo info. Revisit if accounts/saved searches get added.
- **SQL injection is the real concern.** Owner/repo values come from user input and will get used in SQLite queries. Always use parameterized queries, never string-format user input into SQL.
- **Rate-limit our own API before deploying.** Otherwise anyone hitting a live `/analyze/...` could burn our shared GitHub token's rate limit.
- **Restrict CORS to the real deployed frontend URL**, not localhost, once live.
- **Confirm HTTPS is on** for both deployed frontend and backend (usually automatic on Vercel/Render, worth checking).
- Token already stays server-side only (`.env`, never sent to the browser). Keep it that way.

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

- `main.py` is one file right now, fine for now. Split into separate files (routes, GitHub logic, scoring logic) once it starts feeling cluttered.

## Roadmap

- Automated tests (pytest), makes more sense once there's stable logic worth testing, like the health score formula.