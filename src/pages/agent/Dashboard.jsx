import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import VantaBackground from '../../components/VantaBackground'
import ElectricBorder from '../../components/ElectricBorder'
import OnboardingModal from '../../components/OnboardingModal'
import { useCooldown } from '../../hooks/useCooldown'
import { computeTrend } from '../../lib/decayUtils'
import {
  Clock, CheckCircle, Trophy, PlayCircle,
  TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight, Medal, Crown,
} from 'lucide-react'

// Formats seconds into mm:ss or h:mm:ss
function formatCountdown(secs) {
  if (secs <= 0) return '00:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function getRankBadge(rank) {
  if (rank === 1) return { icon: Crown,  color: '#FFD700' }
  if (rank === 2) return { icon: Medal,  color: '#C0C0C0' }
  if (rank === 3) return { icon: Medal,  color: '#CD7F32' }
  return null
}

// Tiny inline sparkline. Points are rendered oldest → newest left to right.
function Sparkline({ values, color, width = 140, height = 32 }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

function TrendCard({ trend, recentSessions }) {
  // Sparkline shows last 14d of scores in chronological order
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const sparkData = (recentSessions ?? [])
    .filter(s => new Date(s.completed_at).getTime() >= cutoff)
    .slice() // copy before reverse
    .reverse() // recentSessions is newest-first; sparkline wants oldest-first
    .map(s => Number(s.score))

  const insufficient = trend?.direction === 'insufficient'

  const accent =
    trend?.direction === 'up'   ? 'var(--color-brand-success)' :
    trend?.direction === 'down' ? 'var(--color-brand-warning)' :
                                  'var(--color-brand-muted)'

  const Arrow =
    trend?.direction === 'up'   ? TrendingUp :
    trend?.direction === 'down' ? TrendingDown :
                                  Minus

  const headline = insufficient
    ? 'Trend unlocks at 3 sessions per window'
    : trend.direction === 'up'
      ? `You're up ${trend.deltaPct}% over the last 14 days`
      : trend.direction === 'down'
        ? `You're down ${Math.abs(trend.deltaPct)}% over the last 14 days`
        : 'Holding steady'

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{
        background: 'var(--color-brand-card)',
        border: `1px solid ${insufficient ? 'var(--color-brand-border)' : accent}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
          Your Trend
        </span>
        <div className="flex items-center gap-1.5" style={{ color: accent }}>
          <Arrow size={15} />
          {!insufficient && (
            <span className="text-xs font-mono font-semibold">
              {trend.deltaPct > 0 ? '+' : ''}{trend.deltaPct}%
            </span>
          )}
        </div>
      </div>

      {insufficient ? (
        <div>
          <p className="text-sm" style={{ color: 'var(--color-brand-text)' }}>
            Keep drilling — trend unlocks once you have 3 completed sessions in each 14-day window.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>
            Recent: {trend?.recentCount ?? 0} · Prior: {trend?.priorCount ?? 0}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          {/* Two-number compare */}
          <div className="flex items-end gap-3 shrink-0">
            <div>
              <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>2 weeks ago</p>
              <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-muted)' }}>
                {trend.priorAvg}
              </p>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--color-brand-muted)', marginBottom: 6 }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Now</p>
              <p className="text-2xl font-bold font-mono" style={{ color: accent }}>
                {trend.recentAvg}
              </p>
            </div>
          </div>

          {/* Sparkline */}
          {sparkData.length >= 2 && (
            <div className="flex-1 flex flex-col items-end min-w-0">
              <Sparkline values={sparkData} color={accent} />
              <p className="text-xs mt-1" style={{ color: 'var(--color-brand-muted)' }}>
                {trend.recentCount} sessions · last 14 days
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs mt-3" style={{ color: 'var(--color-brand-muted)' }}>
        {headline}
      </p>
    </div>
  )
}

// Non-participant agents excluded from the leaderboard (per Rick). Matched on
// the badge number so padding variants all resolve (B-008 == B-8 == 8).
const LEADERBOARD_EXCLUDED_BADGES = new Set([8, 9, 10])
const badgeNumber = (employeeId) => {
  const m = String(employeeId ?? '').match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

function Leaderboard({ agents, myId, loading }) {
  const all = useMemo(() => {
    return (agents ?? [])
      .filter(a => !LEADERBOARD_EXCLUDED_BADGES.has(badgeNumber(a.employee_id)))
      .map(a => ({
        id: a.id,
        employeeId: a.employee_id ?? '—',
        avgScore: Number(a.avg_score ?? 0),
        sessions: Number(a.sessions_this_month ?? 0),
        isMe: a.id === myId,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.sessions - a.sessions)
  }, [agents, myId])

  return (
    <div
      className="rounded-xl flex flex-col h-full"
      style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--color-brand-border)' }}
      >
        <Trophy size={15} style={{ color: 'var(--color-brand-gold)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
          Team Leaderboard
        </span>
        <span
          className="ml-auto text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
        >
          This month
        </span>
      </div>

      {/* Rows */}
      <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: 'var(--color-brand-border)' }}>
        {!loading && all.length === 0 && (
          <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-brand-muted)' }}>
            No agents yet.
          </div>
        )}
        {all.map((agent, idx) => {
          const rank  = idx + 1
          const badge = getRankBadge(rank)
          const BadgeIcon = badge?.icon
          const isMe  = agent.isMe

          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors"
              style={{
                background: isMe
                  ? 'linear-gradient(90deg, rgba(212,175,55,0.08) 0%, transparent 100%)'
                  : 'transparent',
                borderLeft: isMe ? '2px solid var(--color-brand-gold)' : '2px solid transparent',
              }}
            >
              {/* Rank / badge */}
              <div className="w-6 flex items-center justify-center shrink-0">
                {badge ? (
                  <BadgeIcon size={15} style={{ color: badge.color }} />
                ) : (
                  <span
                    className="text-xs font-mono"
                    style={{ color: isMe ? 'var(--color-brand-gold)' : 'var(--color-brand-muted)' }}
                  >
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar — digits from employee ID */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: isMe ? 'var(--color-brand-gold)' : 'var(--color-brand-border)',
                  color:      isMe ? '#0b0f1a' : 'var(--color-brand-muted)',
                }}
              >
                {(agent.employeeId.split('-')[1] ?? agent.employeeId).slice(0, 2)}
              </div>

              {/* Employee ID + sessions */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-mono font-medium truncate"
                  style={{ color: isMe ? 'var(--color-brand-gold)' : 'var(--color-brand-text)' }}
                >
                  {agent.employeeId}{isMe && <span className="ml-1 text-xs opacity-60">(you)</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                  {agent.sessions} sessions
                </p>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <p
                  className="text-sm font-mono font-bold"
                  style={{ color: isMe ? 'var(--color-brand-gold)' : 'var(--color-brand-text)' }}
                >
                  {agent.avgScore}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>avg pts</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div
        className="px-4 py-2.5 text-xs shrink-0"
        style={{
          borderTop: '1px solid var(--color-brand-border)',
          color: 'var(--color-brand-muted)',
        }}
      >
        Ranked by average session score this month
      </div>
    </div>
  )
}

export default function AgentDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // Cooldown is shared with the sidebar — single source of truth, single ticker.
  const cooldown = useCooldown(user?.id ?? null)
  const cooldownSecs = cooldown.remainingSeconds

  const [recert,          setRecert]          = useState(null)
  const [benchmark,       setBenchmark]       = useState(null)
  const [recentSessions,  setRecentSessions]  = useState([])
  const [trendSessions,   setTrendSessions]   = useState([])
  const [leaderboard,     setLeaderboard]     = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [loadError,       setLoadError]       = useState(null)
  const [onboardingOpen,  setOnboardingOpen]  = useState(false)

  // Show onboarding modal on first login (when onboarding_completed_at is null).
  useEffect(() => {
    if (profile && profile.role === 'agent' && !profile.onboarding_completed_at) {
      setOnboardingOpen(true)
    }
  }, [profile])

  const completeOnboarding = useCallback(async () => {
    setOnboardingOpen(false)
    if (!user) return
    const { error } = await supabase
      .from('users')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) console.error('onboarding completion:', error)
  }, [user])

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      // Pull a 28-day window for the trend math; the recent-sessions list reuses the same query.
      const trendCutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
      const [recertRes, benchmarkRes, trendRes, leaderboardRes] = await Promise.all([
        supabase.rpc('get_recertification_status', { p_user_id: user.id }),
        supabase.rpc('get_team_benchmark'),
        supabase
          .from('sessions')
          .select('id, score, status, completed_at, total_time_seconds, total_questions')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('completed_at', trendCutoff)
          .order('completed_at', { ascending: false }),
        supabase.rpc('get_team_leaderboard'),
      ])

      if (recertRes.error)    throw recertRes.error
      if (benchmarkRes.error) throw benchmarkRes.error
      if (trendRes.error)     throw trendRes.error

      setRecert(recertRes.data)
      setBenchmark(benchmarkRes.data)
      const all = trendRes.data ?? []
      setTrendSessions(all)
      setRecentSessions(all.slice(0, 10))
      // Leaderboard is non-fatal — log and render empty if the RPC isn't deployed yet.
      if (leaderboardRes.error) console.error('leaderboard:', leaderboardRes.error)
      setLeaderboard(leaderboardRes.data ?? [])
      setLeaderboardLoading(false)
    } catch (err) {
      console.error(err)
      setLoadError('Failed to load dashboard data.')
      setLeaderboardLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const canDrill = cooldown.canDrill

  const recertPct = recert
    ? Math.min(100, Math.round((recert.completed / recert.required) * 100))
    : 0

  const trend = useMemo(() => computeTrend(trendSessions), [trendSessions])

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Layout bg={<VantaBackground style={{ width: '100%', height: '100%' }} />}>

      <OnboardingModal
        open={onboardingOpen}
        onComplete={completeOnboarding}
      />

      {/* ── Full-width top: header + CTA (above the two-column split) ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-brand-text)' }}>
          {greeting}, {profile?.employee_id ?? 'Agent'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-brand-muted)' }}>
          Surveillance Agent
        </p>
      </div>

      {loadError && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg mb-6 text-sm"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}
        >
          <AlertTriangle size={16} />
          {loadError}
        </div>
      )}

      {/* Start Drill CTA — full width */}
      <ElectricBorder
        active={canDrill}
        color="var(--color-brand-success)"
        borderRadius="1rem"
        className="mb-6"
      >
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{
            background: canDrill
              ? 'linear-gradient(135deg, #1a2d1a, var(--color-brand-card))'
              : 'var(--color-brand-card)',
            border: `1px solid ${canDrill ? 'var(--color-brand-success)' : 'var(--color-brand-border)'}`,
          }}
        >
          <div>
            <p className="font-semibold text-lg" style={{ color: 'var(--color-brand-text)' }}>
              {canDrill ? 'Ready to drill' : 'Cooldown active'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
              {canDrill
                ? '10 questions · 10-minute maximum'
                : `Next drill available in ${formatCountdown(cooldownSecs ?? 0)}`}
            </p>
          </div>

          <button
            onClick={() => navigate('/drill')}
            disabled={!canDrill || cooldown.loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-40 active:scale-[0.97] transition-transform duration-100"
            style={{
              background: canDrill ? 'var(--color-brand-success)' : 'var(--color-brand-border)',
              color: canDrill ? '#0b0f1a' : 'var(--color-brand-muted)',
            }}
          >
            <PlayCircle size={18} />
            Start Drill
          </button>
        </div>
      </ElectricBorder>

      {/* ── Two-column split: stats + sessions | leaderboard ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-stretch">

        {/* LEFT column */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 lg:grid-cols-4">

            {/* Recertification */}
            <div
              className="col-span-2 rounded-xl p-4"
              style={{
                background: 'var(--color-brand-card)',
                border: `1px solid ${recert?.on_track ? 'var(--color-brand-border)' : 'var(--color-brand-warning)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
                  Monthly Recertification
                </span>
                <CheckCircle size={16} style={{ color: recert?.on_track ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }} />
              </div>
              <div className="flex items-end gap-1 mb-3">
                <span className="text-3xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
                  {recert?.completed ?? '—'}
                </span>
                <span className="text-base mb-0.5" style={{ color: 'var(--color-brand-muted)' }}>
                  / {recert?.required ?? 20}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${recertPct}%`,
                    transition: 'width 500ms ease-out',
                    background: recert?.on_track ? 'var(--color-brand-success)' : 'var(--color-brand-warning)',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--color-brand-muted)' }}>
                {recertPct}% complete this month
              </p>
            </div>

            {/* Cooldown */}
            <StatCard
              label="Cooldown"
              value={cooldown.loading ? '…' : cooldownSecs === 0 ? 'Ready' : formatCountdown(cooldownSecs)}
              sub={cooldownSecs ? '4-hour global cooldown' : 'No active cooldown'}
              icon={Clock}
              accent={cooldownSecs ? 'var(--color-brand-warning)' : 'var(--color-brand-success)'}
            />

            {/* Team benchmark */}
            <StatCard
              label="Team Avg"
              value={benchmark?.avg_score != null ? `${benchmark.avg_score}` : '—'}
              sub={`${benchmark?.total_sessions ?? 0} sessions this month`}
              icon={Trophy}
              accent="var(--color-brand-gold)"
            />
          </div>

          {/* Pre/post trend */}
          <TrendCard trend={trend} recentSessions={recentSessions} />

          {/* Recent sessions */}
          <div
            className="rounded-xl flex-1 flex flex-col"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-brand-border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
                Recent Sessions
              </span>
              <button
                onClick={() => navigate('/history')}
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--color-brand-muted)' }}
              >
                View all <ChevronRight size={12} />
              </button>
            </div>

            {recentSessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <TrendingUp size={32} className="mx-auto mb-2" style={{ color: 'var(--color-brand-border)' }} />
                <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
                  No completed sessions yet. Start your first drill!
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
                {recentSessions.map(s => {
                  const date = new Date(s.completed_at)
                  const pct  = Math.round((s.score / 150) * 100)
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold font-mono shrink-0"
                        style={{
                          background: pct >= 70 ? '#0f2f0f' : '#2f1a0f',
                          color: pct >= 70 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)',
                        }}
                      >
                        {s.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: 'var(--color-brand-text)' }}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          <span className="ml-2 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                          {s.total_questions} questions · {Math.floor((s.total_time_seconds ?? 0) / 60)}m {(s.total_time_seconds ?? 0) % 60}s
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono" style={{ color: pct >= 70 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
                          {pct}%
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                          of 150
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>{/* end LEFT column */}

        {/* ── RIGHT: leaderboard ── */}
        <div className="w-full lg:w-64 shrink-0">
          <Leaderboard
            agents={leaderboard}
            myId={user?.id}
            loading={leaderboardLoading}
          />
        </div>

      </div>{/* end two-column split */}
    </Layout>
  )
}
