import { useState } from 'react'
import Layout from '../../components/Layout'
import { Rocket, CheckSquare, Square, ExternalLink } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Supabase — Database & Auth',
    items: [
      { id: 'rls',        text: 'Row Level Security (RLS) is enabled on all tables: users, games, questions, sessions, session_answers, audit_log, login_attempts, recertification_rules, agent_difficulty' },
      { id: 'rpc',        text: 'All RPC functions exist and are SECURITY DEFINER: get_my_role, check_login_lockout, log_login_attempt, check_cooldown, get_recertification_status, get_team_benchmark, update_question_stats, log_audit_event, get_all_agents' },
      { id: 'auth-email', text: 'Supabase Auth → Settings: confirm that "Enable email confirmations" is OFF (agents receive credentials directly from Rick)' },
      { id: 'anon-key',   text: 'Supabase anon key is a PUBLIC key only — never use the service_role key in the frontend' },
      { id: 'pool',       text: 'Question pool seeded: ≥30 active questions per game (Blackjack, Roulette, TCP, LIR, UTH) and ≥15 procedure questions' },
    ],
  },
  {
    title: 'GitHub — Repository & Secrets',
    items: [
      { id: 'secret-url',  text: 'GitHub Secret VITE_SUPABASE_URL is set → Settings → Secrets → Actions' },
      { id: 'secret-key',  text: 'GitHub Secret VITE_SUPABASE_ANON_KEY is set' },
      { id: 'pages',       text: 'GitHub Pages is enabled → Settings → Pages → Source: GitHub Actions' },
      { id: 'nojekyll',   text: '.nojekyll file exists in repository root (prevents Jekyll from mangling the build)' },
      { id: 'base-url',    text: 'vite.config.js has base: \'/ASSET/\' matching the repository name exactly (case-sensitive)' },
    ],
  },
  {
    title: 'User Accounts',
    items: [
      { id: 'rick-acct',   text: 'Rick\'s director account created in Supabase Auth with role = director' },
      { id: 'henk-acct',   text: 'Henk\'s director account created (role = director)' },
      { id: 'angelo-acct', text: 'Angelo\'s supervisor account created (role = supervisor)' },
      { id: 'agents',      text: 'All 10 surveillance agent accounts created; credentials handed off directly' },
      { id: 'pw-format',   text: 'All auth emails follow pattern: {employee_id.toLowerCase()}@stellaris.local' },
    ],
  },
  {
    title: 'Pre-Launch UAT — Agent Flow',
    items: [
      { id: 'uat-login',     text: 'Agent can log in with Employee ID + password' },
      { id: 'uat-lockout',   text: 'Failed login lockout triggers after 5 attempts (15-min window)' },
      { id: 'uat-drill',     text: 'Agent can start and complete a 10-question drill session' },
      { id: 'uat-payout',    text: 'Payout drill accepts correct dollar amount; rejects wrong amount' },
      { id: 'uat-cooldown',  text: '4-hour cooldown prevents a second immediate session' },
      { id: 'uat-results',   text: 'Results screen shows score, missed questions, explanations' },
      { id: 'uat-history',   text: 'Session History page shows the completed session with correct score' },
      { id: 'uat-practice',  text: 'Practice mode completes a full round with no DB writes' },
      { id: 'uat-pw',        text: 'Agent can change their password via Change Password page' },
      { id: 'uat-timeout',   text: '30-minute inactivity timeout redirects to login with reason=timeout' },
    ],
  },
  {
    title: 'Pre-Launch UAT — Management Flow',
    items: [
      { id: 'mgmt-login',    text: 'Henk/Angelo can log in and land on Team Dashboard' },
      { id: 'mgmt-detail',   text: 'Agent Detail page shows sessions and score trend' },
      { id: 'mgmt-complete', text: 'Completion Tracker shows correct session counts and status' },
      { id: 'mgmt-export',   text: 'All 6 Export Excel buttons produce a valid file' },
      { id: 'mgmt-comply',   text: 'Compliance Records export produces a 2-sheet workbook' },
      { id: 'mgmt-qeditor',  text: 'Angelo can create, edit, and deactivate a question' },
      { id: 'mgmt-notif',    text: 'Notification bell shows missed-target alerts (test with a dummy agent)' },
    ],
  },
  {
    title: 'Post-Deploy Verification',
    items: [
      { id: 'deploy-url',   text: 'Production URL loads: https://{github-username}.github.io/ASSET/' },
      { id: 'deploy-login', text: 'Login page renders correctly (no 404 / blank screen)' },
      { id: 'deploy-hash',  text: 'HashRouter navigation works — deep links and refreshes load correctly' },
      { id: 'deploy-cors',  text: 'No CORS errors in browser console when calling Supabase' },
      { id: 'deploy-audit', text: 'Audit log shows at least one LOGIN event after first production login' },
    ],
  },
]

const STORAGE_KEY = 'deploy_checklist_v1'

function loadChecked() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

export default function DeployChecklist() {
  const [checked, setChecked] = useState(loadChecked)

  const toggle = (id) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const allItems  = SECTIONS.flatMap(s => s.items)
  const doneCount = allItems.filter(i => checked[i.id]).length
  const totalCount = allItems.length
  const pct = Math.round((doneCount / totalCount) * 100)

  const resetAll = () => {
    setChecked({})
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <Rocket size={16} style={{ color: 'var(--color-brand-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Deploy Checklist</h1>
            <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>Pre-launch verification for Rick</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start">
          <span className="text-sm font-mono" style={{ color: doneCount === totalCount ? 'var(--color-brand-success)' : 'var(--color-brand-muted)' }}>
            {doneCount}/{totalCount}
          </span>
          <button onClick={resetAll}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-muted)' }}>
            Reset
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="rounded-xl p-4 mb-6"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--color-brand-text)' }}>Overall progress</p>
          <p className="text-sm font-mono font-bold" style={{ color: pct === 100 ? 'var(--color-brand-success)' : 'var(--color-brand-text)' }}>
            {pct === 100 ? '🚀 Ready to launch' : `${pct}%`}
          </p>
        </div>
        <div className="h-2 rounded-full" style={{ background: 'var(--color-brand-border)' }}>
          <div className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: pct === 100 ? 'var(--color-brand-success)' : 'var(--color-brand-gold)' }} />
        </div>
      </div>

      {/* Supabase SQL Editor link */}
      <a href="https://supabase.com/dashboard/project/wcrxiyterasmmfhfdwtz/editor"
        target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm mb-6 w-fit"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-blue)' }}>
        <ExternalLink size={14} /> Open Supabase SQL Editor
      </a>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map(section => {
          const sectionDone = section.items.filter(i => checked[i.id]).length
          return (
            <div key={section.title} className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>{section.title}</p>
                <span className="text-xs font-mono" style={{ color: sectionDone === section.items.length ? 'var(--color-brand-success)' : 'var(--color-brand-muted)' }}>
                  {sectionDone}/{section.items.length}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--color-brand-border)' }}>
                {section.items.map(item => (
                  <label key={item.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                    style={{ opacity: checked[item.id] ? 0.6 : 1 }}>
                    <span className="mt-0.5 shrink-0" style={{ color: checked[item.id] ? 'var(--color-brand-success)' : 'var(--color-brand-muted)' }}>
                      {checked[item.id] ? <CheckSquare size={16} /> : <Square size={16} />}
                    </span>
                    <input type="checkbox" className="sr-only" checked={!!checked[item.id]} onChange={() => toggle(item.id)} />
                    <p className="text-sm leading-relaxed" style={{ color: checked[item.id] ? 'var(--color-brand-muted)' : 'var(--color-brand-text)', textDecoration: checked[item.id] ? 'line-through' : 'none' }}>
                      {item.text}
                    </p>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
