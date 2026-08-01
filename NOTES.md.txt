# Project Notes

Running list of known issues, planned improvements, and decisions. Not all of this needs fixing immediately, this is a working log.

## Known Bugs (fix soon)

- **Contributor count is wrong for popular repos.** GitHub's `/contributors` endpoint paginates results (30 per page by default). We're currently doing `len(response.json())`, which only counts the first page. Repos like `facebook/react` almost certainly have far more than 30 contributors. Needs a real fix: either paginate through all results, or find a way to get GitHub's true total count directly.

## Performance

- `/analyze/{owner}/{repo}` makes 4 sequential requests to GitHub (repo info, contributors, languages, commit activity), one after another. This makes the endpoint noticeably slow. Could be sped up later using async/concurrent requests, a more advanced technique than what we've covered so far.
- No caching yet. Every search re-fetches everything from GitHub, even for repos just searched seconds ago. Planned fix: SQLite caching in Phase 6.

## Rate Limits

- Authenticated limit is 5000 requests/hour. At 4 calls per search, that's roughly 1250 searches/hour, shared across all users once this is live, not per-visitor.
- Caching is the main fix for this, should be prioritized in Phase 6 over other features.
- Token expires in 90 days from creation (set up in Phase 4). Remember to regenerate before it expires.

## Coming Up Soon (not bugs, just not built yet)

- **CORS**: frontend and backend will run on different addresses. Backend needs to explicitly allow requests from the frontend's address, or the browser will block them.
- **URL parsing**: users will paste a full GitHub URL (e.g. `https://github.com/facebook/react`), but the backend expects `owner` and `repo` as separate values. Frontend needs to extract these from the pasted URL.

## Structural / Extensibility

- `main.py` is currently one file. Fine for now, but as more endpoints and logic get added, this should be split into separate files (e.g. routes, GitHub API logic, scoring logic).

## Not Built Yet (lower priority)

- Automated tests (pytest). Makes more sense once there's stable logic worth testing, like the health score formula in Phase 6.