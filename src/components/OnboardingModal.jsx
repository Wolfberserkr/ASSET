import { useState, useEffect } from 'react'
import {
  Shield, PlayCircle, GraduationCap, Clock, CheckCircle,
  TrendingUp, ChevronLeft, ChevronRight, Sparkles,
} from 'lucide-react'

const STEPS = [
  {
    icon: Shield,
    title: 'Welcome to A.S.S.E.T',
    body: (
      <>
        <p>
          A.S.S.E.T is the Surveillance training platform. You'll run short
          gaming drills to keep your payout math, game protection, and procedure knowledge sharp.
        </p>
        <p className="mt-3">
          This quick tour walks through the four things you need to know before your first session.
        </p>
      </>
    ),
  },
  {
    icon: PlayCircle,
    title: 'Drill vs. Practice',
    body: (
      <>
        <div className="flex items-start gap-3 mb-3">
          <PlayCircle size={20} style={{ color: 'var(--color-brand-success)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>Drill</p>
            <p className="text-sm">
              The scored session. <strong>10 questions, 10-minute cap.</strong> Counts toward your
              monthly recertification and feeds the leaderboard.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <GraduationCap size={20} style={{ color: 'var(--color-brand-blue)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>Practice</p>
            <p className="text-sm">
              Unlimited, untracked, immediate feedback. Use it to warm up or work on a weak game —
              nothing you do in Practice is saved or scored.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    icon: Clock,
    title: '4-hour cooldown',
    body: (
      <>
        <p>
          After every completed Drill there's a <strong>4-hour global cooldown</strong> before
          you can start the next one. The Drill button on your sidebar shows the remaining time.
        </p>
        <p className="mt-3">
          Cooldown only applies to Drill. <strong>Practice is always available</strong> — use it
          to keep working between sessions.
        </p>
      </>
    ),
  },
  {
    icon: CheckCircle,
    title: '20 sessions per month',
    body: (
      <>
        <p>
          Your monthly recertification target is <strong>20 completed Drills</strong>. The progress
          ring on your dashboard tracks where you stand for the current calendar month.
        </p>
        <p className="mt-3">
          Only sessions with status <em>completed</em> count — abandoned or timed-out sessions don't.
          Henk and Angelo are notified automatically if anyone misses target at month-end.
        </p>
      </>
    ),
  },
  {
    icon: TrendingUp,
    title: 'Scoring & adaptive difficulty',
    body: (
      <>
        <p>
          Each correct answer is <strong>10 points</strong>, with a time multiplier on the final score:
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>· Finish in ≤ 5 min → <strong>×1.5</strong> (max 150 pts)</li>
          <li>· 5–7.5 min → <strong>×1.25</strong></li>
          <li>· 7.5–10 min → <strong>×1.0</strong></li>
        </ul>
        <p className="mt-3">
          Difficulty adapts per game: <strong>3 in a row right</strong> bumps you up, <strong>2 wrong</strong> drops
          you back down. Questions are weighted toward your weak areas, so the system follows you.
        </p>
        <p className="mt-3 text-xs" style={{ color: 'var(--color-brand-muted)' }}>
          You can replay this tour any time from <strong>Help</strong> in the sidebar.
        </p>
      </>
    ),
  },
]

export default function OnboardingModal({ open, onComplete, onClose, allowClose = false }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep(s => s + 1)
      if (e.key === 'ArrowLeft'  && step > 0) setStep(s => s - 1)
      if (e.key === 'Escape' && allowClose) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, allowClose, onClose])

  if (!open) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden alert-enter"
        style={{
          background: 'var(--color-brand-surface)',
          border: '1px solid var(--color-brand-border)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(212,168,67,0.12), transparent)',
            borderBottom: '1px solid var(--color-brand-border)',
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(79,168,255,0.15)', color: 'var(--color-brand-cyan)' }}
          >
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-brand-cyan)' }}>
              Getting started
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <Icon size={26} style={{ color: 'var(--color-brand-cyan)' }} />
            <h2
              id="onboarding-title"
              className="text-xl font-bold"
              style={{ color: 'var(--color-brand-text)' }}
            >
              {current.title}
            </h2>
          </div>
          <div
            className="text-sm leading-relaxed space-y-2"
            style={{ color: 'var(--color-brand-muted)' }}
          >
            {current.body}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? 'var(--color-brand-cyan)' : 'var(--color-brand-border)',
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--color-brand-border)', background: 'var(--color-brand-bg)' }}
        >
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-30"
            style={{ color: 'var(--color-brand-muted)' }}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {!isLast ? (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.97] transition-transform duration-100"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-grad-a), var(--color-brand-grad-b))', color: '#fff' }}
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.97] transition-transform duration-100"
              style={{ background: 'var(--color-brand-success)', color: '#0b0f1a' }}
            >
              Got it — let's go
              <CheckCircle size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
