import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import Countdown from '../../components/Countdown'
import ScoreChart from '../../components/ScoreChart'
import RingGauge from '../../components/RingGauge'
import OnboardingModal from '../../components/OnboardingModal'
import { useCooldown } from '../../hooks/useCooldown'
import { computeTrend } from '../../lib/decayUtils'
import {
  CheckCircle, TrendingUp, Clock, PlayCircle, AlertTriangle, Bell, Target,
} from 'lucide-react'

// Non-participant agents excluded from the leaderboard (per Rick). Matched on
// the badge number so padding variants all resolve (B-008 == B-8 == 8).
const LEADERBOARD_EXCLUDED_BADGES = new Set([8, 9, 10])
const badgeNumber = (employeeId) => {
  const m = String(employeeId ?? '').match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

// Ring gradients cycle through the accent family; weakest game gets coral.
const RING_COLORS = [
  ['var(--color-brand-cyan)', 'var(--color-brand-teal)'],
  ['var(--color-brand-grad-b)', 'var(--color-brand-cyan)'],
  ['var(--color-brand-coral)', '#ffb36b'],
]

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2
        className="text-[11px] font-semibold uppercase tracking-[0.24em]"
        style={{ color: 'var(--color-brand-muted)' }}
      >
        {children}
      </h2>
      {right}
    </div>
  )
}

function KvRow({ items }) {
  return (
    <div
      className="grid gap-3 py-3"
      style={{
        gridTemplateColumns: items.length > 1 ? '1fr 1fr' : '1fr',
        borderBottom: '1px solid var(--color-brand-border)',
      }}
    >
      {items.map(({ k, v, color }) => (
        <div key={k}>
          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-brand-muted)', opacity: 0.75 }}>
            {k}
          </p>
          <p className="text-sm font-medium" style={{ color: color ?? 'var(--color-brand-cyan)' }}>
            {v}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function AgentDashboard() {
  const { user, profile, department } = useAuth()
  const navigate = useNavigate()

  // Cooldown is shared with the sidebar — single source of truth, single ticker.
  const cooldown = useCooldown(user?.id ?? null)
  const canDrill = cooldown.canDrill

  const [recert,          setRecert]          = useState(null)
  const [trendSessions,   setTrendSessions]   = useState([])
  const [leaderboard,     setLeaderboard]     = useState([])
  const [gameStats,       setGameStats]       = useState([])
  const [assignments,     setAssignments]     = useState([])
  const [loadError,       setLoadError]       = useState(null)
  const [onboardingOpen,  setOnboardingOpen]  = useState(false)
  const [now,             setNow]             = useState(() => new Date())

  // Live clock in the header (minute resolution)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Show onboarding modal on first login (when onboarding_completed_at is null).
  useEffect(() => {
    if (profile && (profile.role === 'agent' || profile.role === 'pit_manager') && !profile.onboarding_completed_at) {
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
      const trendCutoff  = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
      const answerCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const [recertRes, trendRes, leaderboardRes, answersRes, gamesRes, remediationRes] = await Promise.all([
        supabase.rpc('get_recertification_status', { p_user_id: user.id }),
        supabase
          .from('sessions')
          .select('id, score, status, completed_at, total_time_seconds, total_questions')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('completed_at', trendCutoff)
          .order('completed_at', { ascending: false }),
        supabase.rpc('get_team_leaderboard'),
        supabase
          .from('session_answers')
          .select('game_id, is_correct, sessions!inner(user_id)')
          .eq('sessions.user_id', user.id)
          .gte('answered_at', answerCutoff),
        supabase.from('games').select('id, name'),
        supabase.rpc('get_my_remediation'),
      ])

      if (recertRes.error) throw recertRes.error
      if (trendRes.error)  throw trendRes.error

      setRecert(recertRes.data)
      setTrendSessions(trendRes.data ?? [])

      // Leaderboard + accuracy are non-fatal — log and render empty on error.
      if (leaderboardRes.error) console.error('leaderboard:', leaderboardRes.error)
      setLeaderboard(leaderboardRes.data ?? [])

      // Remediation is non-fatal — empty if the migration isn't applied yet.
      if (remediationRes.error) console.error('remediation:', remediationRes.error)
      else setAssignments(remediationRes.data ?? [])

      if (answersRes.error) console.error('game accuracy:', answersRes.error)
      const gameNames = Object.fromEntries((gamesRes.data ?? []).map(g => [g.id, g.name]))
      const byGame = {}
      for (const a of answersRes.data ?? []) {
        if (!a.game_id) continue
        byGame[a.game_id] ??= { correct: 0, total: 0 }
        byGame[a.game_id].total++
        if (a.is_correct) byGame[a.game_id].correct++
      }
      setGameStats(
        Object.entries(byGame)
          .map(([id, s]) => ({ id, name: gameNames[id] ?? '—', acc: s.correct / s.total, total: s.total }))
          .filter(g => g.total >= 5)
          .sort((a, b) => b.total - a.total),
      )
    } catch (err) {
      console.error(err)
      setLoadError('Failed to load dashboard data.')
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const trend = useMemo(() => computeTrend(trendSessions), [trendSessions])

  // 14-day average: prefer the trend window; fall back to a straight average.
  const recentAvg = useMemo(() => {
    if (trend.recentAvg != null) return Math.round(trend.recentAvg)
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    const recent = trendSessions.filter(s => new Date(s.completed_at).getTime() >= cutoff)
    if (recent.length === 0) return null
    return Math.round(recent.reduce((a, s) => a + Number(s.score), 0) / recent.length)
  }, [trend, trendSessions])

  const recertPct    = recert ? Math.min(1, recert.completed / recert.required) : 0
  const sessionsToGo = recert ? Math.max(0, recert.required - recert.completed) : null
  const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeft     = Math.max(0, monthEnd.getDate() - now.getDate())
  const behindPace   = recert && !recert.on_track

  // Rings: the 3 most-drilled games; strongest/weakest for the detail panel.
  const ringGames = gameStats.slice(0, 3)
  const byAccuracy = useMemo(() => gameStats.slice().sort((a, b) => b.acc - a.acc), [gameStats])
  const strongest = byAccuracy[0]
  const weakest   = byAccuracy.length > 1 ? byAccuracy[byAccuracy.length - 1] : null

  const rankedTeam = useMemo(() => {
    return (leaderboard ?? [])
      .filter(a => !LEADERBOARD_EXCLUDED_BADGES.has(badgeNumber(a.employee_id)))
      .map(a => ({
        id: a.id,
        employeeId: a.employee_id ?? '—',
        avgScore: Number(a.avg_score ?? 0),
        sessions: Number(a.sessions_this_month ?? 0),
        isMe: a.id === user?.id,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.sessions - a.sessions)
  }, [leaderboard, user])

  const myRank = rankedTeam.findIndex(a => a.isMe) + 1
  // Panel shows top 4; if I'm ranked below that, swap me into the last slot.
  const panelRows = useMemo(() => {
    const top = rankedTeam.slice(0, 4)
    if (myRank > 4) top[3] = rankedTeam[myRank - 1]
    return top
  }, [rankedTeam, myRank])

  const lastSession = trendSessions[0]
  const bestScore   = trendSessions.length
    ? Math.max(...trendSessions.map(s => Number(s.score)))
    : null

  const avatarInitials = (profile?.employee_id ?? '?').replace(/[^0-9A-Za-z]/g, '').slice(-2).toUpperCase()

  const card = {
    background: 'var(--color-brand-card)',
    border: '1px solid var(--color-brand-border)',
  }

  return (
    <Layout>
      <OnboardingModal open={onboardingOpen} onComplete={completeOnboarding} />

      {loadError && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg mb-6 text-sm"
          style={{ background: '#1f0a0a', border: '1px solid var(--color-brand-danger)', color: '#fca5a5' }}
        >
          <AlertTriangle size={16} />
          {loadError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── MAIN column ── */}
        <div className="flex-1 min-w-0 w-full">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h1
              className="text-sm font-semibold uppercase tracking-[0.3em]"
              style={{ color: 'var(--color-brand-muted)' }}
            >
              Summary
            </h1>
            <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)', opacity: 0.7 }}>
              {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-2.5 mb-5">
            <button
              onClick={() => navigate('/drill')}
              disabled={!canDrill || cooldown.loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white transition-transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))',
                boxShadow: canDrill ? '0 6px 22px rgba(58, 98, 255, 0.4)' : 'none',
              }}
            >
              <PlayCircle size={16} />
              {canDrill ? 'Start Drill' : <>Cooldown · <Countdown endAt={cooldown.endAt} done="00:00" /></>}
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="px-5 py-2.5 rounded-full font-semibold text-sm transition-colors hover:text-[var(--color-brand-text)]"
              style={{ ...card, color: 'var(--color-brand-muted)' }}
            >
              Practice Mode
            </button>
            <button
              onClick={() => navigate('/history')}
              className="px-5 py-2.5 rounded-full font-semibold text-sm transition-colors hover:text-[var(--color-brand-text)]"
              style={{ ...card, color: 'var(--color-brand-muted)' }}
            >
              View History
            </button>
          </div>

          {/* Assigned practice */}
          {assignments.length > 0 && (
            <div className="rounded-2xl p-4 mb-5" style={{ ...card, borderColor: 'var(--color-brand-cyan)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Target size={15} style={{ color: 'var(--color-brand-cyan)' }} />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--color-brand-cyan)' }}>
                  Assigned Practice
                </h2>
              </div>
              <div className="space-y-3">
                {assignments.map(a => {
                  const pct = Math.min(1, Number(a.progress) / a.target_sessions)
                  const due = a.due_date ? new Date(a.due_date + 'T00:00:00') : null
                  const overdue = due && due < new Date(new Date().toDateString())
                  return (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>{a.focus_label}</span>
                          {due && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: overdue ? '#2a0a0a' : 'var(--color-brand-surface)', color: overdue ? '#fca5a5' : 'var(--color-brand-muted)' }}>
                              {overdue ? 'Overdue' : 'Due'} {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {a.note && <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>{a.note}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-2 rounded-full overflow-hidden max-w-[180px]" style={{ background: 'var(--color-brand-surface)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--color-brand-success)' : 'linear-gradient(90deg, var(--color-brand-grad-a), var(--color-brand-grad-b))' }} />
                          </div>
                          <span className="text-xs font-mono" style={{ color: 'var(--color-brand-muted)' }}>{Number(a.progress)}/{a.target_sessions} drills</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(canDrill ? '/drill' : '/practice')}
                        className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold text-white self-start"
                        style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))' }}>
                        {canDrill ? 'Start Drill' : 'Practice'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">

            {/* Sessions this month */}
            <div className="rounded-2xl p-4 flex flex-col gap-1.5" style={card}>
              <span className="text-4xl font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
                {recert?.completed ?? '—'}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                <CheckCircle size={12} />
                Sessions This Month
              </span>
              <div className="h-1 rounded-full mt-1" style={{ background: 'rgba(99,130,210,0.15)' }}>
                <div
                  className="h-1 rounded-full bar-fill"
                  style={{
                    width: `${recertPct * 100}%`,
                    transition: 'width 500ms ease-out',
                    background: 'linear-gradient(90deg, var(--color-brand-grad-a), var(--color-brand-teal))',
                  }}
                />
              </div>
              <span className="text-[11px]" style={{ color: 'var(--color-brand-muted)', opacity: 0.7 }}>
                {recert ? `${recert.completed} of ${recert.required} required · ${recert.on_track ? 'on track' : 'behind pace'}` : 'Loading…'}
              </span>
            </div>

            {/* 14-day average — hero card */}
            <div
              className="rounded-2xl p-4 flex flex-col gap-1.5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #2e5bff 0%, #4f46e5 55%, #6d3df0 100%)',
                boxShadow: '0 10px 34px rgba(58, 98, 255, 0.35)',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(120% 90% at 85% 10%, rgba(255,255,255,0.22), transparent 55%)' }}
              />
              <span className="text-4xl font-bold font-mono text-white" style={{ textShadow: '0 0 24px rgba(255,255,255,0.45)' }}>
                {recentAvg ?? '—'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/75">
                <TrendingUp size={12} />
                Avg Score · 14 Days
              </span>
              <span className="text-[11px] text-white/60">
                {trend.deltaPct != null
                  ? `${trend.deltaPct > 0 ? '+' : ''}${trend.deltaPct}% vs prior two weeks`
                  : 'Trend unlocks at 3 sessions per window'}
              </span>
            </div>

            {/* Recert deadline */}
            <div className="rounded-2xl p-4 flex flex-col gap-1.5" style={card}>
              <span
                className="text-4xl font-bold font-mono"
                style={{
                  color: behindPace ? 'var(--color-brand-coral)' : 'var(--color-brand-text)',
                  textShadow: behindPace ? '0 0 22px rgba(255,122,112,0.35)' : 'none',
                }}
              >
                {String(daysLeft).padStart(2, '0')}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
                <Clock size={12} />
                Days Left{sessionsToGo != null && ` · ${sessionsToGo} Session${sessionsToGo === 1 ? '' : 's'} To Go`}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--color-brand-muted)', opacity: 0.7 }}>
                Recertification closes {monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Score chart */}
          <div className="rounded-2xl p-4 pb-2 mb-5" style={card}>
            <SectionTitle
              right={
                <span
                  className="text-[11px] px-3 py-1 rounded-full"
                  style={{ border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}
                >
                  Last 28 days
                </span>
              }
            >
              Score Chart
            </SectionTitle>
            <ScoreChart sessions={trendSessions} />
          </div>

          {/* Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3.5">
            <div className="rounded-2xl p-4" style={card}>
              <SectionTitle>Accuracy by Game</SectionTitle>
              {ringGames.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--color-brand-muted)' }}>
                  Game accuracy appears after your first few drills.
                </p>
              ) : (
                <div className="flex justify-around gap-4 py-1 flex-wrap">
                  {ringGames.map((g, i) => {
                    // Weakest of the displayed rings gets the coral gradient
                    const isWeakest = weakest && g.id === weakest.id
                    const [a, b] = isWeakest ? RING_COLORS[2] : RING_COLORS[i % 2]
                    return (
                      <div key={g.id} className="text-center">
                        <RingGauge pct={g.acc} size={96} colorA={a} colorB={b} centerText={`${Math.round(g.acc * 100)}%`} />
                        <p className="text-xs mt-2" style={{ color: 'var(--color-brand-muted)' }}>{g.name}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl p-4" style={card}>
              <SectionTitle>Recertification</SectionTitle>
              <div className="flex flex-col items-center pt-1">
                <RingGauge
                  pct={recertPct}
                  size={128}
                  colorA="var(--color-brand-success)"
                  colorB="var(--color-brand-teal)"
                  centerText={`${Math.round(recertPct * 100)}%`}
                  subText={recert ? `${recert.completed} of ${recert.required}` : ''}
                />
                <p className="text-[11px] mt-2" style={{ color: 'var(--color-brand-muted)', opacity: 0.7 }}>
                  {recert?.on_track ? 'On track for this month' : 'Keep drilling to stay certified'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── DETAIL panel ── */}
        <aside className="w-full lg:w-72 shrink-0 rounded-2xl p-5" style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)' }}>

          <div className="flex items-center gap-3 pb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))',
                boxShadow: '0 0 0 2px var(--color-brand-surface), 0 0 0 3.5px rgba(79,130,255,0.4)',
              }}
            >
              {avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--color-brand-text)' }}>
                Agent {profile?.employee_id ?? '—'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-brand-muted)' }}>
                {department === 'pit' ? 'Pit Operations' : 'Surveillance'}
              </p>
            </div>
            <Bell size={16} style={{ color: 'var(--color-brand-muted)' }} />
          </div>

          <div
            className="rounded-xl px-4 py-3 mb-1"
            style={{
              border: '1px solid var(--color-brand-border)',
              background: 'linear-gradient(160deg, rgba(46,91,255,0.10), rgba(21,29,56,0.4))',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--color-brand-muted)', opacity: 0.75 }}>
              Agent ID
            </p>
            <p className="text-xl font-bold font-mono tracking-wide mt-0.5" style={{ color: 'var(--color-brand-text)' }}>
              {profile?.employee_id ?? '—'}
            </p>
          </div>

          <KvRow items={[
            { k: 'Role', v: profile?.role === 'pit_manager' ? 'Pit Manager' : 'Agent' },
            { k: 'Department', v: department === 'pit' ? 'Pit' : 'Surveillance' },
          ]} />
          <KvRow items={[
            {
              k: 'Last Session',
              v: lastSession
                ? new Date(lastSession.completed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                : '—',
            },
            {
              k: 'Cooldown',
              v: cooldown.loading ? '…' : canDrill ? 'Ready' : <Countdown endAt={cooldown.endAt} />,
              color: canDrill ? 'var(--color-brand-success)' : 'var(--color-brand-coral)',
            },
          ]} />
          <KvRow items={[
            { k: 'Best Score · 28d', v: bestScore ?? '—' },
            { k: 'Team Rank', v: myRank > 0 ? `#${myRank} of ${rankedTeam.length}` : '—' },
          ]} />
          {strongest && (
            <KvRow items={[{ k: 'Strongest Game', v: `${strongest.name} · ${Math.round(strongest.acc * 100)}%` }]} />
          )}
          {weakest && (
            <KvRow items={[{
              k: 'Weakest Game',
              v: `${weakest.name} · ${Math.round(weakest.acc * 100)}%`,
              color: 'var(--color-brand-coral)',
            }]} />
          )}

          {/* Mini leaderboard */}
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--color-brand-muted)', opacity: 0.75 }}>
              Team Leaderboard
            </p>
            {panelRows.length === 0 ? (
              <p className="text-xs py-2" style={{ color: 'var(--color-brand-muted)' }}>No agents yet.</p>
            ) : (
              panelRows.map((a) => {
                const rank = rankedTeam.indexOf(a) + 1
                return (
                  <div key={a.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                    <span className="w-4 text-xs font-mono" style={{ color: 'var(--color-brand-muted)', opacity: 0.6 }}>{rank}</span>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={a.isMe
                        ? { background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }
                        : { background: 'var(--color-brand-card)', color: 'var(--color-brand-muted)' }}
                    >
                      {(a.employeeId.split('-')[1] ?? a.employeeId).slice(0, 2)}
                    </div>
                    <span
                      className="flex-1 truncate font-mono text-xs"
                      style={{ color: a.isMe ? 'var(--color-brand-text)' : 'var(--color-brand-muted)' }}
                    >
                      {a.employeeId}{a.isMe && ' (you)'}
                    </span>
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: a.isMe ? 'var(--color-brand-teal)' : 'var(--color-brand-cyan)' }}
                    >
                      {a.avgScore}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          <button
            onClick={() => navigate('/drill')}
            disabled={!canDrill || cooldown.loading}
            className="w-full mt-5 py-3 rounded-xl font-semibold text-sm text-white transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))',
              boxShadow: canDrill ? '0 6px 22px rgba(58, 98, 255, 0.4)' : 'none',
            }}
          >
            {canDrill ? 'Start Drill — 10 Questions' : <>Next drill in <Countdown endAt={cooldown.endAt} done="00:00" /></>}
          </button>
        </aside>
      </div>
    </Layout>
  )
}
