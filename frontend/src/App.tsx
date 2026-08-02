import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface CommitWeek {
  total: number
  week: number
  days: number[]
}

interface HealthScore {
  total: number
  breakdown: {
    activity: number
    contributors: number
    documentation: number
    issues: number
  }
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
  health_score: HealthScore
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
    return weeks.map((w) => ({
      date: new Date(w.week * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      commits: w.total,
    }))
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

function getHealthColor(score: number) {
  if (score >= 80) return { text: 'text-green-600', bg: 'bg-green-100' }
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-100' }
  return { text: 'text-red-600', bg: 'bg-red-100' }
}

interface RepoCardProps {
  data: RepoData
  winsStars?: boolean
  winsForks?: boolean
  winsContributors?: boolean
  winsHealth?: boolean
}

function RepoCard({ data, winsStars, winsForks, winsContributors, winsHealth }: RepoCardProps) {
  const [timeRange, setTimeRange] = useState<'year' | 'month' | 'week'>('year')

  const chartData = Array.isArray(data.commit_activity) ? getChartData(timeRange, data.commit_activity) : []
  const healthColor = getHealthColor(data.health_score.total)

  return (
    <div className="bg-white rounded p-6 shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{data.name}</h2>
          <span
            className={`text-sm font-bold px-2 py-1 rounded ${healthColor.bg} ${healthColor.text} ${winsHealth ? 'ring-2 ring-green-400' : ''}`}
          >
            {data.health_score.total}/100
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block">
            Updated on {new Date(data.last_updated).toLocaleDateString()} at{' '}
            {new Date(data.last_updated).toLocaleTimeString()}
          </span>
          {data.cached ? (
            <span className="text-xs text-amber-600">⚡ Cached {formatCacheAge(data.cache_age_seconds)}</span>
          ) : (
            <span className="text-xs text-green-600">● Live data</span>
          )}
        </div>
      </div>

      <p className="text-gray-600 mb-4">{data.description}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className={`p-4 rounded ${winsStars ? 'bg-green-50 ring-2 ring-green-400' : 'bg-gray-50'}`}>
          ⭐ Stars: {data.stars}
        </div>
        <div className={`p-4 rounded ${winsForks ? 'bg-green-50 ring-2 ring-green-400' : 'bg-gray-50'}`}>
          🍴 Forks: {data.forks}
        </div>
        <div className="bg-gray-50 p-4 rounded">🐛 Open Issues: {data.open_issues}</div>
        <div className={`p-4 rounded ${winsContributors ? 'bg-green-50 ring-2 ring-green-400' : 'bg-gray-50'}`}>
          👥 Contributors: {data.contributors_count}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold mb-2">Health Score Breakdown</h3>
        <div className="space-y-2">
          {[
            { label: 'Activity', value: data.health_score.breakdown.activity, max: 40 },
            { label: 'Contributors', value: data.health_score.breakdown.contributors, max: 20 },
            { label: 'Documentation', value: data.health_score.breakdown.documentation, max: 20 },
            { label: 'Issue Health', value: data.health_score.breakdown.issues, max: 20 },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{item.label}</span>
                <span>{item.value}/{item.max}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(item.value / item.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold mb-2">Language Breakdown</h3>
        <div className="space-y-2">
          {getLanguagePercentages(data.languages).map((lang) => (
            <div key={lang.name} className="flex justify-between text-sm">
              <span>{lang.name}</span>
              <span className="text-gray-500">{lang.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {Array.isArray(data.commit_activity) && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Commit Activity</h3>
            <div className="flex gap-2">
              {(['week', 'month', 'year'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded ${
                    timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={timeRange === 'week' ? 0 : 'preserveStartEnd'} />
                <YAxis />
                <Tooltip allowEscapeViewBox={{ x: false, y: false }} />
                <Line type="monotone" dataKey="commits" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.commit_activity === 'pending' && (
        <div className="mt-6 text-sm text-gray-500">
          Commit activity is still being calculated by GitHub, try again in a moment.
        </div>
      )}
    </div>
  )
}

async function fetchRepoData(url: string): Promise<RepoData> {
  const parsed = parseRepoUrl(url)
  if (!parsed) {
    throw new Error('Please enter a valid GitHub repository URL (e.g. github.com/owner/repo)')
  }

  const response = await fetch(`http://127.0.0.1:8000/analyze/${parsed.owner}/${parsed.repo}`)

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Too many requests, please wait a moment.')
  }

  return response.json()
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [results, setResults] = useState<RepoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [compareMode, setCompareMode] = useState(false)
  const [repoUrl2, setRepoUrl2] = useState('')
  const [results2, setResults2] = useState<RepoData | null>(null)
  const [error2, setError2] = useState('')

  const handleAnalyze = async () => {
    setIsLoading(true)
    setError('')
    setResults(null)

    try {
      const data = await fetchRepoData(repoUrl)
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompare = async () => {
    setIsLoading(true)
    setError('')
    setError2('')
    setResults(null)
    setResults2(null)

    const [result1, result2] = await Promise.allSettled([fetchRepoData(repoUrl), fetchRepoData(repoUrl2)])

    if (result1.status === 'fulfilled') {
      setResults(result1.value)
    } else {
      setError(result1.reason instanceof Error ? result1.reason.message : 'Something went wrong')
    }

    if (result2.status === 'fulfilled') {
      setResults2(result2.value)
    } else {
      setError2(result2.reason instanceof Error ? result2.reason.message : 'Something went wrong')
    }

    setIsLoading(false)
  }

  const handleSubmit = () => {
    if (compareMode) {
      handleCompare()
    } else {
      handleAnalyze()
    }
  }

  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    setResults2(null)
    setError2('')
  }

  const starsWinner =
    results && results2 ? (results.stars === results2.stars ? null : results.stars > results2.stars ? 'a' : 'b') : null
  const forksWinner =
    results && results2 ? (results.forks === results2.forks ? null : results.forks > results2.forks ? 'a' : 'b') : null
  const contributorsWinner =
    results && results2
      ? results.contributors_count === results2.contributors_count
        ? null
        : results.contributors_count > results2.contributors_count
          ? 'a'
          : 'b'
      : null
  const healthWinner =
    results && results2
      ? results.health_score.total === results2.health_score.total
        ? null
        : results.health_score.total > results2.health_score.total
          ? 'a'
          : 'b'
      : null

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-2">GitHub Repository Analyzer</h1>
      <button onClick={toggleCompareMode} className="text-sm text-blue-600 underline mb-6">
        {compareMode ? 'Switch to single search' : 'Compare two repositories'}
      </button>

      <div className={`grid gap-2 mb-4 ${compareMode ? 'grid-cols-2' : ''}`}>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => {
            setRepoUrl(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
          placeholder={compareMode ? 'First repository' : 'Enter GitHub repository URL'}
          className="p-2 border border-gray-300 rounded w-full"
          disabled={isLoading}
          autoFocus
          aria-label="GitHub repository URL"
        />
        {compareMode && (
          <input
            type="text"
            value={repoUrl2}
            onChange={(e) => {
              setRepoUrl2(e.target.value)
              setError2('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="Second repository"
            className="p-2 border border-gray-300 rounded w-full"
            disabled={isLoading}
            aria-label="Second GitHub repository URL"
          />
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 mb-6"
      >
        {isLoading ? 'Analyzing...' : compareMode ? 'Compare' : 'Analyze'}
      </button>

      <div className={compareMode ? 'grid grid-cols-2 gap-4' : ''}>
        <div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">{error}</div>}
          {results && (
            <RepoCard
              data={results}
              winsStars={starsWinner === 'a'}
              winsForks={forksWinner === 'a'}
              winsContributors={contributorsWinner === 'a'}
              winsHealth={healthWinner === 'a'}
            />
          )}
        </div>
        {compareMode && (
          <div>
            {error2 && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">{error2}</div>}
            {results2 && (
              <RepoCard
                data={results2}
                winsStars={starsWinner === 'b'}
                winsForks={forksWinner === 'b'}
                winsContributors={contributorsWinner === 'b'}
                winsHealth={healthWinner === 'b'}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App