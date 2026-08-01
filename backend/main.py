from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "GitHub Analyzer API is running"}

@app.get("/analyze/{owner}/{repo}")
def analyze_repo(owner: str, repo: str):
    return {
        "owner": owner,
        "repo": repo,
        "status": "endpoint working, real data comes next"
    }