from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import httpx
import requests
import os
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
import sqlite3
import json
import time
import asyncio

DB_PATH = "cache.db"
CACHE_TTL_SECONDS = 3600  # 1 hour

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS repo_cache (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            data TEXT NOT NULL,
            cached_at REAL NOT NULL,
            PRIMARY KEY (owner, repo)
        )
    """)
    conn.commit()
    conn.close()

init_db()
load_dotenv()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")


@app.get("/")
def root():
    return {"message": "GitHub Analyzer API is running"}


def calculate_health_score(contributors_count, commit_activity, open_issues, description, has_readme):
    if isinstance(commit_activity, list) and len(commit_activity) > 0:
        recent_commits = sum(w["total"] for w in commit_activity[-4:])
    else:
        recent_commits = 0
    activity_score = min(recent_commits / 20 * 40, 40)

    if contributors_count >= 21:
        contributors_score = 20
    elif contributors_count >= 6:
        contributors_score = 15
    elif contributors_count >= 2:
        contributors_score = 10
    else:
        contributors_score = 5

    docs_score = (15 if has_readme else 0) + (5 if description else 0)

    issue_ratio = open_issues / max(contributors_count, 1)
    if issue_ratio <= 2:
        issues_score = 20
    elif issue_ratio <= 5:
        issues_score = 15
    elif issue_ratio <= 15:
        issues_score = 10
    elif issue_ratio <= 50:
        issues_score = 5
    else:
        issues_score = 0

    total = round(activity_score + contributors_score + docs_score + issues_score)

    return {
        "total": total,
        "breakdown": {
            "activity": round(activity_score),
            "contributors": contributors_score,
            "documentation": docs_score,
            "issues": issues_score,
        },
    }


def get_contributors_count(response: httpx.Response) -> int:
    if response.status_code != 200:
        return 0
    if "Link" in response.headers:
        link_header = response.headers["Link"]
        last_links = [link for link in link_header.split(",") if 'rel="last"' in link]
        if last_links:
            last_url = last_links[0].split(";")[0].strip().strip("<>")
            query_params = parse_qs(urlparse(last_url).query)
            return int(query_params["page"][0])
    return len(response.json())


@app.get("/analyze/{owner}/{repo}")
@limiter.limit("10/minute")
async def analyze_repo(request: Request, owner: str, repo: str):
    conn = sqlite3.connect(DB_PATH)
    cached = conn.execute(
        "SELECT data, cached_at FROM repo_cache WHERE owner = ? AND repo = ?",
        (owner, repo)
    ).fetchone()

    if cached:
        data_json, cached_at = cached
        if time.time() - cached_at < CACHE_TTL_SECONDS:
            conn.close()
            result = json.loads(data_json)
            result["cached"] = True
            result["cache_age_seconds"] = int(time.time() - cached_at)
            return result

    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}"}

    async with httpx.AsyncClient() as client:
        repo_response = await client.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)

        if repo_response.status_code == 404:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Repository '{owner}/{repo}' not found")
        if repo_response.status_code != 200:
            conn.close()
            raise HTTPException(status_code=repo_response.status_code, detail="Error fetching repository data")

        data = repo_response.json()

        contributors_response, languages_response, commit_activity_response, readme_response = await asyncio.gather(
            client.get(
                f"https://api.github.com/repos/{owner}/{repo}/contributors",
                headers=headers,
                params={"per_page": 1, "anon": "true"},
            ),
            client.get(f"https://api.github.com/repos/{owner}/{repo}/languages", headers=headers),
            client.get(f"https://api.github.com/repos/{owner}/{repo}/stats/commit_activity", headers=headers),
            client.get(f"https://api.github.com/repos/{owner}/{repo}/readme", headers=headers),
        )

    contributors_count = get_contributors_count(contributors_response)
    languages = languages_response.json() if languages_response.status_code == 200 else {}

    if commit_activity_response.status_code == 202:
        commit_activity = "pending"
    elif commit_activity_response.status_code == 200:
        commit_activity = commit_activity_response.json()
    else:
        commit_activity = []

    has_readme = readme_response.status_code == 200

    result = {
        "name": data["name"],
        "description": data["description"],
        "owner": data["owner"]["login"],
        "language": data["language"],
        "stars": data["stargazers_count"],
        "forks": data["forks_count"],
        "open_issues": data["open_issues_count"],
        "last_updated": data["updated_at"],
        "contributors_count": contributors_count,
        "languages": languages,
        "commit_activity": commit_activity,
        "health_score": calculate_health_score(contributors_count, commit_activity, data["open_issues_count"], data["description"], has_readme),
        "cached": False,
        "cache_age_seconds": 0,
    }

    if commit_activity != "pending":
        conn.execute(
            "INSERT OR REPLACE INTO repo_cache (owner, repo, data, cached_at) VALUES (?, ?, ?, ?)",
            (owner, repo, json.dumps(result), time.time())
        )
        conn.commit()
    conn.close()

    return result


@app.get("/rate-limit")
def check_rate_limit():
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}"}
    response = requests.get("https://api.github.com/rate_limit", headers=headers)
    return response.json()