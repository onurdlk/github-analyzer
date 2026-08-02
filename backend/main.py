from fastapi import FastAPI, HTTPException
import requests
import os
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import time

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

app = FastAPI()

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

@app.get("/analyze/{owner}/{repo}")
def analyze_repo(owner: str, repo: str):
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

    repo_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)

    if repo_response.status_code == 404:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Repository '{owner}/{repo}' not found")
    if repo_response.status_code != 200:
        conn.close()
        raise HTTPException(status_code=repo_response.status_code, detail="Error fetching repository data")

    data = repo_response.json()

    contributors_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/contributors",
        headers=headers,
        params={"per_page": 1, "anon": "true"}
    )

    if contributors_response.status_code == 200:
        if "Link" in contributors_response.headers:
            link_header = contributors_response.headers["Link"]
            last_links = [link for link in link_header.split(",") if 'rel="last"' in link]
            if last_links:
                last_url = last_links[0].split(";")[0].strip().strip("<>")
                query_params = parse_qs(urlparse(last_url).query)
                contributors_count = int(query_params["page"][0])
            else:
                contributors_count = len(contributors_response.json())
        else:
            contributors_count = len(contributors_response.json())
    else:
        contributors_count = 0

    languages_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}/languages", headers=headers)
    languages = languages_response.json() if languages_response.status_code == 200 else {}

    commit_activity_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}/stats/commit_activity", headers=headers)

    if commit_activity_response.status_code == 202:
        commit_activity = "pending"
    elif commit_activity_response.status_code == 200:
        commit_activity = commit_activity_response.json()
    else:
        commit_activity = []

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