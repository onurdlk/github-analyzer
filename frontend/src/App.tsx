import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'


interface CommitWeek {
  total: number
  week: number
  days: number[]
}

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
  commit_activity: CommitWeek[] | 'pending'
  cached: boolean
  cache_age_seconds: number
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

function getDailyData(weeks: CommitWeek[]) {
  const daily: { date: string; commits: number; timestamp: number }[] = []
  weeks.forEach((w) => {
    w.days.forEach((count, i) => {
      const dayMs = w.week * 1000 + i * 24 * 60 * 60 * 1000
      daily.push({
        date: new Date(dayMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        commits: count,
        timestamp: dayMs,
      })
    })
  })
  return daily.filter((d) => d.timestamp <= Date.now())
}

function getChartData(range: 'year' | 'month' | 'week', weeks: CommitWeek[]) {
  if (range === 'year') {
    return weeks.map((w, i, arr) => {
      const weekEndMs = w.week * 1000 + 7 * 24 * 60 * 60 * 1000
      return {
        date: new Date(w.week * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        commits: w.total,
      }
    })
  }
  if (range === 'month') {
    return getDailyData(weeks.slice(-5)).slice(-30)
  }
  return getDailyData(weeks.slice(-1))
}

function formatCacheAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [results, setResults] = useState<RepoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [timeRange, setTimeRange] = useState<'year' | 'month' | 'week'>('year')

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

  const chartData = results && Array.isArray(results.commit_activity)
    ? getChartData(timeRange, results.commit_activity)
    : []

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
            <div className="text-right">
              <span className="text-xs text-gray-400 block">
                Updated on {new Date(results.last_updated).toLocaleDateString()} at{' '}
                {new Date(results.last_updated).toLocaleTimeString()}
              </span>
              {results.cached ? (
                <span className="text-xs text-amber-600">⚡ Cached {formatCacheAge(results.cache_age_seconds)}</span>
              ) : (
                <span className="text-xs text-green-600">● Live data</span>
              )}
            </div>
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
          {Array.isArray(results.commit_activity) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Commit Activity</h3>
                <div className="flex gap-2">
                  {(['week', 'month', 'year'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 text-sm rounded ${
                        timeRange === range
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      interval={timeRange === 'week' ? 0 : 'preserveStartEnd'}
                    />
                    <YAxis />
                    <Tooltip allowEscapeViewBox={{ x: false, y: false }} />
                    <Line type="monotone" dataKey="commits" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {results.commit_activity === 'pending' && (
            <div className="mt-6 text-sm text-gray-500">
              Commit activity is still being calculated by GitHub, try again in a moment.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App