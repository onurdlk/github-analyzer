import { useState } from 'react'

interface RepoData {
  name: string
  description: string
  owner: string
  language: string
  stars: number
  forks: number
  open_issues: number
  last_updated: string
  contributors_count: number
  languages: Record<string, number>
  commit_activity: unknown
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [results, setResults] = useState<RepoData | null>(null)

  const handleAnalyze = async () => {
    const parts = repoUrl.replace('https://github.com/', '').split('/')
    const owner = parts[0]
    const repo = parts[1]

    try {
      const response = await fetch(`http://127.0.0.1:8000/analyze/${owner}/${repo}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">GitHub Repository Analyzer</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Enter GitHub repository URL"
          className="flex-1 p-2 border border-gray-300 rounded"
        />
        <button
          onClick={handleAnalyze}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Analyze
        </button>
      </div>

      {results && (
        <div className="bg-white rounded p-6 shadow">
          <h2 className="text-2xl font-bold mb-4">{results.name}</h2>
          <p className="text-gray-600 mb-4">{results.description}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded">⭐ Stars: {results.stars}</div>
            <div className="bg-gray-50 p-4 rounded">🍴 Forks: {results.forks}</div>
            <div className="bg-gray-50 p-4 rounded">💻 Language: {results.language}</div>
            <div className="bg-gray-50 p-4 rounded">👥 Contributors: {results.contributors_count}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App