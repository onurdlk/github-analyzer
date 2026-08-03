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

## Legal / Disclaimer / Privacy Notice

- Currently low risk, but not zero-touch: no accounts, no cookies, no analytics. But the rate limiter reads visitor IPs (in-memory only, to enforce the 10/min cap, not stored or linked to anything). Once deployed, the hosting provider (Vercel/Render) will independently log basic access data (IP, timestamp) as standard infrastructure practice.
- Plan: a real Privacy Notice, linked from a footer, same pattern as any real site.
- Draft text:

  > This is an educational portfolio project. It pulls public repository data live from GitHub's API and displays it, no accounts, no signup, no cookies, no tracking. Your IP address is used briefly, in memory only, to enforce a rate limit that protects the site from abuse, it isn't stored or linked to anything else. The hosting provider independently logs basic access data (IP, timestamp) as standard practice, governed by their own privacy policy. If the AI summary feature is used, the repository data shown, already public on GitHub, may be sent to Groq's API to generate a short summary. No data here is sold or shared for advertising. This project isn't affiliated with GitHub.

- Worth skimming GitHub's API Terms of Service before going live.
- Get real legal advice if this ever gets real traffic or money involved.

## Planned: AI Summary Feature

- **Provider/model decided: Groq, Llama 3.3 70B.** No card required, no phone verification, no training-data clause on their free models (unlike Gemini/Mistral). 1,000 requests/day, 12,000 tokens/minute free, comfortably above anything our own daily cap will use. Fast inference (Groq's hardware advantage), well-tested model for straightforward instruction-following, not the newest/flashiest, which is a feature here, not a bug, predictability over capability for a task this simple.
- Switching providers later is cheap if this doesn't work out, one function sends a prompt and gets text back, not a structural dependency.
- Opt-in only, a "Generate AI Summary" button, not automatic on every search.
- Cache summaries per repo in SQLite, same idea as the main caching plan.
- Hard daily cap on total AI generations, independent of caching.
- Low `max_tokens` limit per call.
- Set an actual spending cap on the API key in Groq's console, real safety net beyond our own code (though free tier makes this mostly moot).

## Deployment

- Local `uvicorn`/`npm run dev` are dev-only. Once deployed: frontend on Vercel, backend on Render/Railway, both run independently of whether the local machine is on.
- Free tiers may spin down the backend after inactivity, slower first response (10-30 sec) after idle. Still reachable, just slower once in a while. Normal for free tiers.
- Could deploy a basic version earlier than Phase 7 if we want it live/shareable sooner. Optional.

## Code Structure

- `main.py` is one file, growing. Split into separate files (routes, GitHub logic, scoring logic) once it starts feeling cluttered, worth considering soon given its current size.

## Roadmap

- Automated tests (pytest), makes more sense now that there's stable logic worth testing (health score formula, caching behavior).