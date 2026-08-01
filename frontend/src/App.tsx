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

function getLanguagePercentages(languages: Record<string, number>) {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0)
  return Object.entries(languages)
    .map(([name, bytes]) => ({
      name,
      percentage: ((bytes / total) * 100).toFixed(1),
    }))
    .sort((a, b) => Number(b.percentage) - Number(a.percentage))
}

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().toLowerCase().replace(/\/+$/, '')

  const match = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (match) {
    return { owner: match[1], repo: match[2] }
  }

  const parts = trimmed.split('/')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] }
  }

  return null
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [results, setResults] = useState<RepoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    const parsed = parseRepoUrl(repoUrl)

    if (!parsed) {
      setError('Please enter a valid GitHub repository URL (e.g. github.com/owner/repo)')
      return
    }

    setIsLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch(`http://127.0.0.1:8000/analyze/${parsed.owner}/${parsed.repo}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Something went wrong')
      }

      const data = await response.json()
      setResults(data)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Something went wrong')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">GitHub Repository Analyzer</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => {
            setRepoUrl(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAnalyze()
            }
          }}
          placeholder="Enter GitHub repository URL"
          className="flex-1 p-2 border border-gray-300 rounded"
          disabled={isLoading}
          autoFocus
          aria-label="GitHub repository URL"
        />
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {results && (
        <div className="bg-white rounded p-6 shadow">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">{results.name}</h2>
            <span className="text-xs text-gray-400">
              Updated on {new Date(results.last_updated).toLocaleDateString()} at{' '}
              {new Date(results.last_updated).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-gray-600 mb-4">{results.description}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded">⭐ Stars: {results.stars}</div>
            <div className="bg-gray-50 p-4 rounded">🍴 Forks: {results.forks}</div>
            <div className="bg-gray-50 p-4 rounded">🐛 Open Issues: {results.open_issues}</div>
            <div className="bg-gray-50 p-4 rounded">👥 Contributors: {results.contributors_count}</div>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Language Breakdown</h3>
            <div className="space-y-2">
              {getLanguagePercentages(results.languages).map((lang) => (
                <div key={lang.name} className="flex justify-between text-sm">
                  <span>{lang.name}</span>
                  <span className="text-gray-500">{lang.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App