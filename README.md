# GitHub Repository Analyzer

A full-stack web app that analyzes any public GitHub repository and returns real stats, a health score, commit activity trends, and an AI-generated summary, all pulled live from GitHub's API.

**Live app**: https://github-analyzer-beta-steel.vercel.app

## Features

- **Repository stats**: stars, forks, open issues, contributors (correctly handles GitHub's API pagination), language breakdown by percentage
- **Health score**: a 0-100 score weighing recent activity, contributor count, documentation, and issue health, with a visual breakdown
- **Commit activity chart**: interactive Year / Month / Week views built from GitHub's weekly and daily commit data
- **Repository comparison**: analyze two repos side by side, with the winning metric highlighted on each
- **AI-generated summary**: an opt-in, LLM-written summary of the repo (Groq / Llama 3.3 70B), cached per repo to control cost
- **Caching**: SQLite-backed cache so repeat searches don't re-hit GitHub's API
- **Rate limiting**: protects the shared GitHub API token from abuse

## Tech stack

**Backend**: Python, FastAPI, httpx (concurrent API calls), SQLite, slowapi (rate limiting)
**Frontend**: React, TypeScript, Vite, Tailwind CSS v4, Recharts
**External APIs**: GitHub REST API, Groq API

## Architecture

Frontend (Vercel) → FastAPI backend (Render) → GitHub API + Groq API, with SQLite caching in between to reduce redundant calls and stay within GitHub's rate limit.

## Project structure


github-analyzer/

├──backend/     FastAPI server, GitHub/Groq API integration, SQLite caching

├──frontend/    React + TypeScript + Vite app

├──NOTES.md     Running log of decisions, known issues, and fixes

├──PRIVACY.md   Privacy notice

└──LICENSE      MIT


## License

MIT, see [LICENSE](LICENSE).

## Author

[Onur Dilek](https://github.com/onurdlk)