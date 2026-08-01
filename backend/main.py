from fastapi import FastAPI, HTTPException
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

@app.get("/")
def root():
    return {"message": "GitHub Analyzer API is running"}

@app.get("/analyze/{owner}/{repo}")
def analyze_repo(owner: str, repo: str):
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}"}

    repo_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)

    if repo_response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Repository '{owner}/{repo}' not found")
    if repo_response.status_code != 200:
        raise HTTPException(status_code=repo_response.status_code, detail="Error fetching repository data")

    data = repo_response.json()

    contributors_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}/contributors", headers=headers)
    contributors_count = len(contributors_response.json()) if contributors_response.status_code == 200 else 0

    languages_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}/languages", headers=headers)
    languages = languages_response.json() if languages_response.status_code == 200 else {}

    commit_activity_response = requests.get(f"https://api.github.com/repos/{owner}/{repo}/stats/commit_activity", headers=headers)

    if commit_activity_response.status_code == 202:
        commit_activity = "pending"
    elif commit_activity_response.status_code == 200:
        commit_activity = commit_activity_response.json()
    else:
        commit_activity = []

    return {
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
        "commit_activity": commit_activity
    }