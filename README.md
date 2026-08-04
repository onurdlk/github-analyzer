# GitHub Repository Analyzer

A web app that analyzes any public GitHub repository and displays stats, a health score, commit activity, and an AI-generated summary.

**Live:** https://github-analyzer-beta-steel.vercel.app

## Features

- Search any public repo by URL
- Stars, forks, issues, contributors, language breakdown
- Repository health score (activity, contributors, documentation, issue health)
- Commit activity chart with Year/Month/Week views
- Side-by-side comparison of two repositories
- AI-generated summary (Groq, Llama 3.3 70B)
- Server-side caching and rate limiting

## Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS, Recharts, Vite
**Backend:** FastAPI, SQLite, httpx
**APIs:** GitHub REST API, Groq API
**Deployment:** Vercel (frontend), Render (backend)

## Running Locally

**Backend:**