import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import VantaBackground from '../../components/VantaBackground'
import {
  Clock, CheckCircle, Trophy, PlayCircle,
  TrendingUp, AlertTriangle, ChevronRight, Medal, Crown,
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

// Fake agent pool — realistic casino surveillance names + varied scores
const FAKE_AGENTS = [
  { id: 'fake-1', name: 'Carlos M.',  avgScore: 142, sessions: 18 },
  { id: 'fake-2', name: 'Diana V.',   avgScore: 137, sessions: 20 },
  { id: 'fake-3', name: 'Marco R.',   avgScore: 131, sessions: 17 },
  { id: 'fake-4', name: 'Sophia L.',  avgScore: 126, sessions: 19 },
  { id: 'fake-5', name: 'James T.',   avgScore: 118, sessions: 15 },
  { id: 'fake-6', name: 'Priya N.',   avgScore: 111, sessions: 20 },
  { id: 'fake-7', name: 'Alex B.',    avgScore: 103, sessions: 12 },
  { id: 'fake-8', name: 'Tommy K.',   avgScore:  91, sessions:  9 },
]

function getRankBadge(rank) {
  if (rank === 1) return { icon: Crown,  color: '#FFD700' }
  if (rank === 2) return { icon: Medal,  color: '#C0C0C0' }
  if (rank === 3) return { icon: Medal,  color: '#CD7F32' }
  return null
}

function Leaderboard({ myName, myAvgScore, mySessions }) {
  // Merge real user into fake pool and sort
  const me = { id: 'me', name: myName ?? 'You', avgScore: myAvgScore ?? 0, sessions: mySessions ?? 0, isMe: true }
  const all = useMemo(() => {
    return [...FAKE_AGENTS, me].sort((a, b) => b.avgScore - a.avgScore)
  }, [myAvgScore, myName, mySessions])

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

              {/* Avatar initial */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: isMe ? 'var(--color-brand-gold)' : 'var(--color-brand-border)',
                  color:      isMe ? '#0b0f1a' : 'var(--color-brand-muted)',
                }}
              >
                {agent.name[0].toUpperCase()}
              </div>

              {/* Name + sessions */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: isMe ? 'var(--color-brand-gold)' : 'var(--color-brand-text)' }}
                >
                  {agent.name}{isMe && <span className="ml-1 text-xs opacity-60">(you)</span>}
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
        Ranked by average session score · Simulation preview
      </div>
    </div>
  )
}

export default function AgentDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [cooldownSecs,    setCooldownSecs]    = useState(null)
  const [recert,          setRecert]          = useState(null)
  const [benchmark,       setBenchmark]       = useState(null)
  const [recentSessions,  setRecentSessions]  = useState([])
  const [loadError,       setLoadError]       = useState(null)

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [cooldownRes, recertRes, benchmarkRes, sessionsRes] = await Promise.all([
        supabase.rpc('check_cooldown', { p_user_id: user.id }),
        supabase.rpc('get_recertification_status', { p_user_id: user.id }),
        supabase.rpc('get_team_benchmark'),
        supabase
          .from('sessions')
          .select('id, score, status, completed_at, total_time_seconds, total_questions')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(10),
      ])

      if (cooldownRes.error)  throw cooldownRes.error
      if (recertRes.error)    throw recertRes.error
      if (benchmarkRes.error) throw benchmarkRes.error

      setCooldownSecs(cooldownRes.data ?? 0)
      setRecert(recertRes.data)
      setBenchmark(benchmarkRes.data)
      setRecentSessions(sessionsRes.data ?? [])
    } catch (err) {
      console.error(err)
      setLoadError('Failed to load dashboard data.')
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // Countdown tick
  useEffect(() => {
    if (!cooldownSecs) return
    const tick = setInterval(() => {
      setCooldownSecs(prev => {
        if (prev <= 1) { clearInterval(tick); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [cooldownSecs])

  const canDrill = cooldownSecs === 0

  const recertPct = recert
    ? Math.min(100, Math.round((recert.completed / recert.required) * 100))
    : 0

  // Compute agent's own avg score from recent sessions for leaderboard
  const myAvgScore = useMemo(() => {
    if (!recentSessions.length) return 0
    const avg = recentSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / recentSessions.length
    return Math.round(avg)
  }, [recentSessions])

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Layout bg={<VantaBackground style={{ width: '100%', height: '100%' }} />}>

      {/* ── Full-width top: header + CTA (above the two-column split) ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-brand-text)' }}>
          {greeting}, {profile?.name?.split(' ')[0] ?? 'Agent'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-brand-muted)' }}>
          {profile?.employee_id} · Surveillance Agent
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
      <div
        className="rounded-2xl p-5 mb-6 flex items-center justify-between"
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
          disabled={!canDrill || cooldownSecs === null}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-40"
          style={{
            background: canDrill ? 'var(--color-brand-success)' : 'var(--color-brand-border)',
            color: canDrill ? '#0b0f1a' : 'var(--color-brand-muted)',
          }}
        >
          <PlayCircle size={18} />
          Start Drill
        </button>
      </div>

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
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${recertPct}%`,
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
              value={cooldownSecs === null ? '…' : cooldownSecs === 0 ? 'Ready' : formatCountdown(cooldownSecs)}
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
            myName={profile?.name?.split(' ')[0] ?? 'You'}
            myAvgScore={myAvgScore}
            mySessions={recert?.completed ?? recentSessions.length}
          />
        </div>

      </div>{/* end two-column split */}
    </Layout>
  )
}
