import { useState } from 'react'
import Layout from '../../components/Layout'
import OnboardingModal from '../../components/OnboardingModal'
import {
  PlayCircle, GraduationCap, Clock, CheckCircle, TrendingUp,
  Shield, RotateCcw, KeyRound, Library, FileText, AlertTriangle,
} from 'lucide-react'

function Section({ icon: Icon, title, children, accent = 'var(--color-brand-gold)' }) {
  return (
    <section
      className="rounded-xl p-5 mb-4"
      style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,168,67,0.10)', color: accent }}
        >
          <Icon size={18} />
        </div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-brand-text)' }}>
          {title}
        </h2>
      </div>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: 'var(--color-brand-muted)' }}>
        {children}
      </div>
    </section>
  )
}

export default function HowItWorks() {
  const [tourOpen, setTourOpen] = useState(false)

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-brand-text)' }}>
            How It Works
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-brand-muted)' }}>
            Reference for everything in A.S.S.E.T — drills, scoring, cooldown, and recertification.
          </p>
        </div>
        <button
          onClick={() => setTourOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.97] transition-transform duration-100 shrink-0"
          style={{ background: 'var(--color-brand-gold)', color: '#0b0f1a' }}
        >
          <RotateCcw size={15} />
          Replay tour
        </button>
      </div>

      <Section icon={Shield} title="What is A.S.S.E.T?">
        <p>
          The Surveillance training platform. Short, repeatable gaming drills keep
          your payout math, game protection, and floor procedures sharp between live shifts.
        </p>
      </Section>

      <Section icon={PlayCircle} title="Drill — the scored session" accent="var(--color-brand-success)">
        <ul className="space-y-1.5 list-disc list-inside">
          <li><strong>10 questions</strong> drawn from across all 5 games + shared procedure questions.</li>
          <li><strong>10-minute hard cap</strong> — the timer is shown on screen.</li>
          <li>Question pool is weighted toward your weak games — the more you miss in an area, the more it shows up.</li>
          <li>Counts toward your <strong>monthly recertification</strong> and the team leaderboard.</li>
          <li>Abandoning or letting the timer run out does <strong>not</strong> count.</li>
        </ul>
      </Section>

      <Section icon={GraduationCap} title="Practice — unlimited and untracked" accent="var(--color-brand-blue)">
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Pick a single game (Blackjack, Roulette, TCP, LIR, UTH, Procedures) or Mixed.</li>
          <li>Immediate feedback after every answer — correct answer + explanation shown right away.</li>
          <li><strong>Zero database writes.</strong> No score, no cooldown, no effect on adaptive difficulty.</li>
          <li>Always available — works during cooldown.</li>
        </ul>
      </Section>

      <Section icon={Clock} title="4-hour cooldown" accent="var(--color-brand-warning)">
        <p>
          After every <em>completed</em> Drill, a 4-hour global cooldown applies before the next one.
          The Drill button on the sidebar shows the remaining time. Cooldown does not apply to Practice.
        </p>
      </Section>

      <Section icon={CheckCircle} title="Monthly recertification">
        <p>
          You're required to complete <strong>20 Drill sessions per calendar month</strong>. The
          progress ring on your dashboard tracks your count for the month.
        </p>
        <p>
          Only sessions with status <em>completed</em> count. Henk and Angelo see an automatic
          notification at month-end if anyone misses target.
        </p>
      </Section>

      <Section icon={TrendingUp} title="Scoring">
        <p>Each correct answer is <strong>10 points</strong>. The final score is multiplied by your finish time:</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg p-3" style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-success)' }}>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>×1.5</p>
            <p className="text-xs">≤ 5 min</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>×1.25</p>
            <p className="text-xs">5–7.5 min</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)' }}>
            <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>×1.0</p>
            <p className="text-xs">7.5–10 min</p>
          </div>
        </div>
        <p className="mt-3">
          Maximum possible per session: <strong>150 points</strong> (10 correct × 10 pts × 1.5).
        </p>
      </Section>

      <Section icon={TrendingUp} title="Adaptive difficulty">
        <p>Each game tracks your difficulty level independently (Easy → Medium → Hard):</p>
        <ul className="space-y-1.5 list-disc list-inside mt-2">
          <li><strong>3 correct in a row</strong> at the current level → step up.</li>
          <li><strong>2 wrong in a row</strong> at the current level → step down.</li>
          <li>Bounded between Easy (1) and Hard (3).</li>
        </ul>
      </Section>

      <Section icon={AlertTriangle} title="Anti-gaming and timeouts" accent="var(--color-brand-danger)">
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Closing the tab mid-drill marks the session abandoned — it doesn't count toward recert.</li>
          <li>30 minutes of inactivity logs you out.</li>
          <li>5 failed login attempts in 15 minutes locks your account — see Rick to unlock.</li>
        </ul>
      </Section>

      <Section icon={Library} title="Other tabs at a glance">
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <Library size={14} className="mt-1 shrink-0" style={{ color: 'var(--color-brand-muted)' }} />
            <span><strong>Resources</strong> — payout charts, rules, and reference material per game.</span>
          </li>
          <li className="flex items-start gap-2">
            <FileText size={14} className="mt-1 shrink-0" style={{ color: 'var(--color-brand-muted)' }} />
            <span><strong>My History</strong> — every completed session with score, time, and missed-question review.</span>
          </li>
          <li className="flex items-start gap-2">
            <KeyRound size={14} className="mt-1 shrink-0" style={{ color: 'var(--color-brand-muted)' }} />
            <span><strong>Change Password</strong> — update the password Rick gave you. No admin approval needed.</span>
          </li>
        </ul>
      </Section>

      <p className="text-xs text-center mt-6" style={{ color: 'var(--color-brand-muted)' }}>
        Questions? Talk to Rick, Angelo, or Henk.
      </p>

      <OnboardingModal
        open={tourOpen}
        allowClose
        onComplete={() => setTourOpen(false)}
        onClose={() => setTourOpen(false)}
      />
    </Layout>
  )
}
