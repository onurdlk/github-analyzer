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
  if (score >= 80) return { text: 'text-diff-add', bg: 'bg-diff-add-light' }
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-100' }
  return { text: 'text-diff-remove', bg: 'bg-diff-remove-light' }
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
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [displayedSummary, setDisplayedSummary] = useState('')

  const handleGenerateSummary = async () => {
    setSummaryLoading(true)
    setSummaryError('')
    setSummary(null)
    setDisplayedSummary('')

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/analyze/${data.owner}/${data.name}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          language: data.language,
          stars: data.stars,
          forks: data.forks,
          contributors_count: data.contributors_count,
          open_issues: data.open_issues,
          health_score: data.health_score.total,
        }),
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Could not generate summary')
      }
      const result = await response.json()
      setSummary(result.summary)

      let i = 0
      const interval = setInterval(() => {
        i++
        setDisplayedSummary(result.summary.slice(0, i))
        if (i >= result.summary.length) clearInterval(interval)
      }, 15)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSummaryLoading(false)
    }
  }    
  const chartData = Array.isArray(data.commit_activity) ? getChartData(timeRange, data.commit_activity) : []
  const healthColor = getHealthColor(data.health_score.total)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{data.name}</h2>
          <span
            className={`text-sm font-display font-bold px-2 py-1 rounded-lg ${healthColor.bg} ${healthColor.text} ${winsHealth ? 'ring-2 ring-diff-add' : ''}`}
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
        <div className={`p-4 rounded-xl ${winsStars ? 'bg-diff-add-light ring-2 ring-diff-add' : 'bg-gray-50'}`}>
          ⭐ Stars: <span className="font-display font-semibold">{data.stars}</span>
        </div>
        <div className={`p-4 rounded-xl ${winsForks ? 'bg-diff-add-light ring-2 ring-diff-add' : 'bg-gray-50'}`}>
          🍴 Forks: <span className="font-display font-semibold">{data.forks}</span>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl">
          🐛 Open Issues: <span className="font-display font-semibold">{data.open_issues}</span>
        </div>
        <div className={`p-4 rounded-xl ${winsContributors ? 'bg-diff-add-light ring-2 ring-diff-add' : 'bg-gray-50'}`}>
          👥 Contributors: <span className="font-display font-semibold">{data.contributors_count}</span>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-display font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wide">Health Score Breakdown</h3>
        <div className="space-y-3">
          {[
            { label: 'Activity', value: data.health_score.breakdown.activity, max: 40 },
            { label: 'Contributors', value: data.health_score.breakdown.contributors, max: 20 },
            { label: 'Documentation', value: data.health_score.breakdown.documentation, max: 20 },
            { label: 'Issue Health', value: data.health_score.breakdown.issues, max: 20 },
          ].map((item) => {
            const segments = 20
            const filled = Math.round((item.value / item.max) * segments)
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 shrink-0">{item.label}</span>
                <div className="flex gap-0.5 flex-1">
                  {Array.from({ length: segments }).map((_, i) => (
                    <div key={i} className={`h-3 flex-1 rounded-sm ${i < filled ? 'bg-diff-add' : 'bg-gray-100'}`} />
                  ))}
                </div>
                <span className="font-display text-xs text-gray-400 w-12 text-right shrink-0">
                  {item.value}/{item.max}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold mb-2">AI Summary</h3>
        {!summary && !summaryLoading && (
          <button onClick={handleGenerateSummary} className="text-sm text-blue-600 underline">
            ✨ Generate AI Summary
          </button>
        )}
        {summaryLoading && <p className="text-sm text-gray-400 italic">✨ Generating summary...</p>}
        {summaryError && (
          <p className="text-sm text-red-600">
            {summaryError}{' '}
            <button onClick={handleGenerateSummary} className="underline">
              Try again
            </button>
          </p>
        )}
        {summary && (
          <div className="bg-blue-50 border border-blue-100 rounded p-3">
            <p className="text-sm text-gray-700">
              {displayedSummary}
              {displayedSummary.length < summary.length && <span className="animate-pulse">▋</span>}
            </p>
          </div>
        )}
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

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded p-6 max-w-lg w-full shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Privacy Notice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This is an educational portfolio project. It pulls public repository data live from GitHub's API and
          displays it, no accounts, no signup, no cookies, no tracking. Your IP address is used briefly, in memory
          only, to enforce a rate limit that protects the site from abuse, it isn't stored or linked to anything
          else. The hosting provider independently logs basic access data (IP, timestamp) as standard practice,
          governed by their own privacy policy. If the AI summary feature is used, the repository data shown,
          already public on GitHub, may be sent to Groq's API to generate a short summary. No data here is sold or
          shared for advertising. This project isn't affiliated with GitHub.
        </p>
      </div>
    </div>
  )
}

async function fetchRepoData(url: string): Promise<RepoData> {
  const parsed = parseRepoUrl(url)
  if (!parsed) {
    throw new Error('Please enter a valid GitHub repository URL (e.g. github.com/owner/repo)')
  }

const response = await fetch(`${import.meta.env.VITE_API_URL}/analyze/${parsed.owner}/${parsed.repo}`)

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
  const [showPrivacy, setShowPrivacy] = useState(false)
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
      <div className="min-h-screen bg-surface p-4 sm:p-8 font-body flex flex-col">
      <div className="flex-1">
      <h1 className="text-3xl font-display font-bold mb-2 text-gray-900">GitHub Repository Analyzer</h1>
      <button onClick={toggleCompareMode} className="text-sm text-brand font-medium hover:underline mb-6">
          {compareMode ? 'Switch to single search' : 'Compare two repositories'}
      </button>

      <div className={`grid gap-2 mb-4 ${compareMode ? 'grid-cols-1 sm:grid-cols-2' : ''}`}>
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
          className="p-3 border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
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
            className="p-3 border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            disabled={isLoading}
            aria-label="Second GitHub repository URL"
          />
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="bg-brand text-white px-5 py-3 rounded-xl font-medium hover:bg-brand/90 active:scale-95 disabled:bg-brand/40 transition mb-6"
      >
        {isLoading ? 'Analyzing...' : compareMode ? 'Compare' : 'Analyze'}
      </button>

      <div className={compareMode ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
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
      <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
        <button onClick={() => setShowPrivacy(true)} className="underline hover:text-gray-600">
          Privacy
        </button>
      </footer>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  )
}

export default App