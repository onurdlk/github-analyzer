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
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Repository '{owner}/{repo}' not found")

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Error fetching repository data")

    data = response.json()

    return {
        "name": data["name"],
        "description": data["description"],
        "owner": data["owner"]["login"],
        "language": data["language"],
        "stars": data["stargazers_count"],
        "forks": data["forks_count"],
        "open_issues": data["open_issues_count"],
        "last_updated": data["updated_at"]
    }