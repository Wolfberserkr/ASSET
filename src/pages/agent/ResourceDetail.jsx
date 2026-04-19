import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ArrowLeft, FileText, Video, Calculator, ExternalLink, VideoOff, FileX } from 'lucide-react'

// ─── Payout calculator configs ────────────────────────────────────────────────
// Keyed by game.name. Each section has a label, a list of bet inputs, and a
// payout table. Ratios are "win per unit wagered" (e.g. 35 = 35:1).

const CALC = {
  'Blackjack': {
    sections: [
      {
        id: 'main',
        title: 'Main Bet',
        inputLabel: 'Bet amount ($)',
        outcomes: [
          { label: 'Blackjack',           ratio: 1.5,  note: '3:2',  highlight: true },
          { label: 'Win',                 ratio: 1,    note: '1:1'   },
          { label: 'Insurance win',       ratio: 2,    note: '2:1'   },
          { label: 'Push',                ratio: 0,    note: 'bet returned', muted: true },
        ],
      },
    ],
  },

  'Roulette': {
    sections: [
      {
        id: 'main',
        title: 'Bet Amount',
        inputLabel: 'Bet amount ($)',
        outcomes: [
          { label: 'Straight Up',         ratio: 35,  note: '35:1',  highlight: true },
          { label: 'Split',               ratio: 17,  note: '17:1'  },
          { label: 'Street (3 numbers)',  ratio: 11,  note: '11:1'  },
          { label: 'Corner (4 numbers)',  ratio: 8,   note: '8:1'   },
          { label: 'Six Line (6 numbers)',ratio: 5,   note: '5:1'   },
          { label: 'Column / Dozen',      ratio: 2,   note: '2:1'   },
          { label: 'Even Money',          ratio: 1,   note: '1:1'   },
        ],
      },
    ],
  },

  'Three Card Poker': {
    sections: [
      {
        id: 'pairplus',
        title: 'Pair Plus Bet',
        inputLabel: 'Pair Plus bet ($)',
        outcomes: [
          { label: 'Straight Flush',      ratio: 40,  note: '40:1',  highlight: true },
          { label: 'Three of a Kind',     ratio: 30,  note: '30:1',  highlight: true },
          { label: 'Straight',            ratio: 6,   note: '6:1'   },
          { label: 'Flush',               ratio: 4,   note: '4:1'   },
          { label: 'Pair',                ratio: 1,   note: '1:1'   },
        ],
      },
      {
        id: 'antebonus',
        title: 'Ante Bonus',
        inputLabel: 'Ante bet ($)',
        note: 'Paid on top of the Ante win — Ante must qualify',
        outcomes: [
          { label: 'Straight Flush',      ratio: 5,   note: '5:1',   highlight: true },
          { label: 'Three of a Kind',     ratio: 4,   note: '4:1'   },
          { label: 'Straight',            ratio: 1,   note: '1:1'   },
        ],
      },
    ],
  },

  "Let It Ride": {
    specialType: 'let_it_ride',
    outcomes: [
      { label: 'Royal Flush',            ratio: 1000, note: '1000:1', highlight: true },
      { label: 'Straight Flush',         ratio: 200,  note: '200:1',  highlight: true },
      { label: 'Four of a Kind',         ratio: 50,   note: '50:1',   highlight: true },
      { label: 'Full House',             ratio: 11,   note: '11:1'  },
      { label: 'Flush',                  ratio: 8,    note: '8:1'   },
      { label: 'Straight',               ratio: 5,    note: '5:1'   },
      { label: 'Three of a Kind',        ratio: 3,    note: '3:1'   },
      { label: 'Two Pair',               ratio: 2,    note: '2:1'   },
      { label: 'Pair (10s or better)',   ratio: 1,    note: '1:1'   },
    ],
  },

  "Ultimate Texas Hold'em": {
    specialType: 'uth',
    tripsOutcomes: [
      { label: 'Royal Flush',            ratio: 50,   note: '50:1',   highlight: true },
      { label: 'Straight Flush',         ratio: 40,   note: '40:1',   highlight: true },
      { label: 'Four of a Kind',         ratio: 20,   note: '20:1',   highlight: true },
      { label: 'Full House',             ratio: 7,    note: '7:1'   },
      { label: 'Flush',                  ratio: 7,    note: '7:1'   },
      { label: 'Straight',               ratio: 4,    note: '4:1'   },
      { label: 'Three of a Kind',        ratio: 3,    note: '3:1'   },
    ],
    blindOutcomes: [
      { label: 'Royal Flush',            ratio: 500,  note: '500:1',  highlight: true },
      { label: 'Straight Flush',         ratio: 50,   note: '50:1',   highlight: true },
      { label: 'Four of a Kind',         ratio: 10,   note: '10:1',   highlight: true },
      { label: 'Full House',             ratio: 3,    note: '3:1'   },
      { label: 'Flush',                  ratio: 1.5,  note: '3:2'   },
      { label: 'Straight',               ratio: 1,    note: '1:1'   },
      { label: 'Below Straight',         ratio: 0,    note: 'push',   muted: true },
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEmbedUrl(url = '') {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`
  if (url.includes('youtube.com/embed/')) return url
  return null
}

function fmt(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function parseBet(val) {
  const n = parseFloat(val)
  return isNaN(n) || n < 0 ? 0 : n
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-[0.97]"
      style={{
        background: active ? 'var(--color-brand-gold)' : 'var(--color-brand-surface)',
        color:      active ? '#0b0f1a' : 'var(--color-brand-muted)',
        border:     `1px solid ${active ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
        transition: 'background-color 120ms ease-out, color 120ms ease-out, transform 100ms ease-out',
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}

function PayoutRow({ label, note, payout, highlight, muted }) {
  const color = muted
    ? 'var(--color-brand-muted)'
    : highlight
      ? 'var(--color-brand-gold)'
      : 'var(--color-brand-success)'

  return (
    <div className="flex items-center justify-between py-2.5 px-4"
      style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
      <div>
        <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>{label}</span>
        <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-brand-muted)' }}>{note}</span>
      </div>
      <span className="text-sm font-bold font-mono" style={{ color }}>
        {muted && payout === 0 ? '—' : fmt(payout)}
      </span>
    </div>
  )
}

// ─── Section calculator (standard: one bet → outcome table) ──────────────────
function SectionCalc({ section }) {
  const [bet, setBet] = useState('')
  const amount = parseBet(bet)

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--color-brand-text)' }}>{section.title}</p>
          {section.note && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>{section.note}</p>
          )}
        </div>
        <div className="relative shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono"
            style={{ color: 'var(--color-brand-muted)' }}>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={bet}
            onChange={e => setBet(e.target.value)}
            className="w-32 pl-7 pr-3 py-2 rounded-lg text-sm font-mono outline-none text-right"
            style={{
              background: 'var(--color-brand-card)',
              border: '1px solid var(--color-brand-border)',
              color: 'var(--color-brand-text)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-brand-gold)'}
            onBlur={e  => e.target.style.borderColor = 'var(--color-brand-border)'}
          />
        </div>
      </div>
      {/* Header row */}
      <div className="flex items-center justify-between py-1.5 px-4"
        style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-brand-muted)' }}>Outcome</span>
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-brand-muted)' }}>Win</span>
      </div>
      {section.outcomes.map(o => (
        <PayoutRow
          key={o.label}
          label={o.label}
          note={o.note}
          payout={o.muted ? 0 : amount * o.ratio}
          highlight={o.highlight}
          muted={o.muted}
        />
      ))}
    </div>
  )
}

// ─── Let It Ride calculator ───────────────────────────────────────────────────
function LetItRideCalc({ config }) {
  const [bet, setBet]           = useState('')
  const [activeBets, setActive] = useState(3)
  const amount = parseBet(bet)
  const total  = amount * activeBets

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
      {/* Controls */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-4"
        style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
        <div>
          <p className="text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
            Bet per spot ($)
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono"
              style={{ color: 'var(--color-brand-muted)' }}>$</span>
            <input
              type="number" min="0" step="0.01" placeholder="0.00"
              value={bet} onChange={e => setBet(e.target.value)}
              className="w-32 pl-7 pr-3 py-2 rounded-lg text-sm font-mono outline-none text-right"
              style={{
                background: 'var(--color-brand-card)',
                border: '1px solid var(--color-brand-border)',
                color: 'var(--color-brand-text)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-brand-gold)'}
              onBlur={e  => e.target.style.borderColor = 'var(--color-brand-border)'}
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
            Active bets at payout
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => setActive(n)}
                className="w-10 h-9 rounded-lg text-sm font-bold active:scale-[0.95]"
                style={{
                  background: activeBets === n ? 'var(--color-brand-gold)' : 'var(--color-brand-card)',
                  color:      activeBets === n ? '#0b0f1a' : 'var(--color-brand-muted)',
                  border:     `1px solid ${activeBets === n ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
                  transition: 'background-color 100ms ease-out, transform 100ms ease-out',
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Total at risk</p>
          <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand-gold)' }}>
            {fmt(total)}
          </p>
        </div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between py-1.5 px-4"
        style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-brand-muted)' }}>Hand</span>
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-brand-muted)' }}>
          Total win ({activeBets} bet{activeBets !== 1 ? 's' : ''} × ratio)
        </span>
      </div>
      {config.outcomes.map(o => (
        <PayoutRow
          key={o.label}
          label={o.label}
          note={o.note}
          payout={total * o.ratio}
          highlight={o.highlight}
          muted={o.muted}
        />
      ))}
    </div>
  )
}

// ─── UTH calculator ───────────────────────────────────────────────────────────
function UTHCalc({ config }) {
  const [ante,  setAnte]  = useState('')
  const [play,  setPlay]  = useState('4')   // multiplier
  const [trips, setTrips] = useState('')
  const anteAmt  = parseBet(ante)
  const playAmt  = anteAmt * parseFloat(play)
  const tripsAmt = parseBet(trips)

  const BetInput = ({ label, value, onChange, note }) => (
    <div>
      <p className="text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
        {label}
      </p>
      {note && <p className="text-xs mb-1" style={{ color: 'var(--color-brand-muted)' }}>{note}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono"
          style={{ color: 'var(--color-brand-muted)' }}>$</span>
        <input
          type="number" min="0" step="0.01" placeholder="0.00"
          value={value} onChange={e => onChange(e.target.value)}
          className="w-28 pl-7 pr-3 py-2 rounded-lg text-sm font-mono outline-none text-right"
          style={{
            background: 'var(--color-brand-card)',
            border: '1px solid var(--color-brand-border)',
            color: 'var(--color-brand-text)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--color-brand-gold)'}
          onBlur={e  => e.target.style.borderColor = 'var(--color-brand-border)'}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="rounded-xl p-4"
        style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
        <p className="text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
          Enter Bets
        </p>
        <div className="flex flex-wrap gap-5 items-end">
          <BetInput label="Ante / Blind (equal)" value={ante} onChange={setAnte} />
          <div>
            <p className="text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
              Play Multiplier
            </p>
            <div className="flex gap-2">
              {['4','3','2','1'].map(m => (
                <button key={m} onClick={() => setPlay(m)}
                  className="w-10 h-9 rounded-lg text-sm font-bold active:scale-[0.95]"
                  style={{
                    background: play === m ? 'var(--color-brand-gold)' : 'var(--color-brand-card)',
                    color:      play === m ? '#0b0f1a' : 'var(--color-brand-muted)',
                    border:     `1px solid ${play === m ? 'var(--color-brand-gold)' : 'var(--color-brand-border)'}`,
                    transition: 'background-color 100ms ease-out, transform 100ms ease-out',
                  }}>
                  {m}×
                </button>
              ))}
            </div>
          </div>
          <BetInput label="Trips (optional)" value={trips} onChange={setTrips} />
        </div>
        {anteAmt > 0 && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4"
            style={{ borderTop: '1px solid var(--color-brand-border)' }}>
            {[
              { label: 'Ante',  val: anteAmt  },
              { label: 'Blind', val: anteAmt  },
              { label: `Play (${play}×)`, val: playAmt   },
              ...(tripsAmt > 0 ? [{ label: 'Trips', val: tripsAmt }] : []),
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>{label}</p>
                <p className="text-sm font-bold font-mono" style={{ color: 'var(--color-brand-text)' }}>
                  {fmt(val)}
                </p>
              </div>
            ))}
            <div className="ml-auto text-right">
              <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>Total at risk</p>
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand-gold)' }}>
                {fmt(anteAmt * 2 + playAmt + tripsAmt)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Trips payout table */}
      {tripsAmt > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>Trips Bonus</span>
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>Win</span>
          </div>
          {config.tripsOutcomes.map(o => (
            <PayoutRow key={o.label} label={o.label} note={o.note}
              payout={tripsAmt * o.ratio} highlight={o.highlight} muted={o.muted} />
          ))}
        </div>
      )}

      {/* Ante + Blind + Play win summary */}
      {anteAmt > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <div className="px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
              Ante + Play Win (when player wins)
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-4"
            style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>
              Ante win <span className="text-xs ml-1 font-mono" style={{ color: 'var(--color-brand-muted)' }}>1:1</span>
            </span>
            <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>
              {fmt(anteAmt)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-4"
            style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-brand-text)' }}>
              Play win <span className="text-xs ml-1 font-mono" style={{ color: 'var(--color-brand-muted)' }}>1:1</span>
            </span>
            <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-brand-success)' }}>
              {fmt(playAmt)}
            </span>
          </div>
          {/* Blind payout table */}
          <div className="px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--color-brand-border)', background: 'var(--color-brand-surface)' }}>
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-brand-muted)' }}>
              Blind Bonus (qualifying hands only)
            </span>
          </div>
          {config.blindOutcomes.map(o => (
            <PayoutRow key={o.label} label={o.label} note={o.note}
              payout={o.muted ? 0 : anteAmt * o.ratio} highlight={o.highlight} muted={o.muted} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResourceDetail() {
  const { gameId } = useParams()
  const navigate   = useNavigate()
  const [game,     setGame]     = useState(null)
  const [resource, setResource] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('rules')

  useEffect(() => {
    Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('game_resources').select('*').eq('game_id', gameId).maybeSingle(),
    ]).then(([gRes, rRes]) => {
      setGame(gRes.data)
      setResource(rRes.data)
      setLoading(false)
    })
  }, [gameId])

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-brand-gold)' }} />
      </div>
    </Layout>
  )

  if (!game) return (
    <Layout>
      <p className="text-center py-16" style={{ color: 'var(--color-brand-muted)' }}>Game not found.</p>
    </Layout>
  )

  const calcConfig = CALC[game.name]
  const videos     = resource?.videos ?? []
  const pdfUrl     = resource?.pdf_url ?? null

  return (
    <Layout>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/resources')}
          className="p-2 rounded-lg active:scale-[0.95]"
          style={{
            background: 'var(--color-brand-card)',
            border: '1px solid var(--color-brand-border)',
            color: 'var(--color-brand-muted)',
            transition: 'transform 100ms ease-out',
          }}
          aria-label="Back to Resources"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>{game.name}</h1>
          <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            {game.drill_type === 'payout_drill' ? 'Payout drill' : 'Quiz'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === 'rules'}      onClick={() => setTab('rules')}      icon={FileText}    label="Rules & Payouts" />
        <TabButton active={tab === 'videos'}     onClick={() => setTab('videos')}     icon={Video}       label="Videos" />
        <TabButton active={tab === 'calculator'} onClick={() => setTab('calculator')} icon={Calculator}  label="Payout Calculator" />
      </div>

      {/* ── Rules tab ──────────────────────────────────────────── */}
      {tab === 'rules' && (
        <div>
          {pdfUrl ? (
            <>
              <div className="flex items-center justify-end mb-3">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg active:scale-[0.97]"
                  style={{
                    background: 'var(--color-brand-card)',
                    border: '1px solid var(--color-brand-border)',
                    color: 'var(--color-brand-muted)',
                    transition: 'transform 100ms ease-out',
                  }}
                >
                  <ExternalLink size={14} />
                  Open in new tab
                </a>
              </div>
              <div className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--color-brand-border)' }}>
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
                  title={`${game.name} rules`}
                  className="w-full"
                  style={{ height: '72vh', display: 'block' }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <FileX size={32} style={{ color: 'var(--color-brand-muted)' }} />
              <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>No PDF uploaded yet</p>
              <p className="text-sm text-center max-w-xs" style={{ color: 'var(--color-brand-muted)' }}>
                Rick can add the rules PDF by updating the <code className="font-mono text-xs">game_resources</code> table
                in Supabase for this game.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Videos tab ─────────────────────────────────────────── */}
      {tab === 'videos' && (
        <div>
          {videos.length > 0 ? (
            <div className="space-y-6">
              {videos.map((v, i) => {
                const embedUrl = toEmbedUrl(v.url)
                return (
                  <div key={i} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
                    {/* Title bar */}
                    <div className="px-4 py-3 flex items-center gap-2"
                      style={{ borderBottom: '1px solid var(--color-brand-border)' }}>
                      <Video size={15} style={{ color: 'var(--color-brand-gold)' }} />
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
                        {v.title || `Video ${i + 1}`}
                      </p>
                    </div>
                    {embedUrl ? (
                      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                        <iframe
                          src={embedUrl}
                          title={v.title || `Video ${i + 1}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3">
                        <a href={v.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm underline" style={{ color: 'var(--color-brand-blue)' }}>
                          {v.url}
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <VideoOff size={32} style={{ color: 'var(--color-brand-muted)' }} />
              <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>No videos added yet</p>
              <p className="text-sm text-center max-w-xs" style={{ color: 'var(--color-brand-muted)' }}>
                Rick can add YouTube links by updating the <code className="font-mono text-xs">videos</code> column
                in the <code className="font-mono text-xs">game_resources</code> table.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Calculator tab ─────────────────────────────────────── */}
      {tab === 'calculator' && (
        <div>
          {calcConfig ? (
            <div className="space-y-5">
              {calcConfig.specialType === 'let_it_ride' && (
                <LetItRideCalc config={calcConfig} />
              )}
              {calcConfig.specialType === 'uth' && (
                <UTHCalc config={calcConfig} />
              )}
              {!calcConfig.specialType && calcConfig.sections.map(section => (
                <SectionCalc key={section.id} section={section} />
              ))}
              <p className="text-xs text-center pb-2" style={{ color: 'var(--color-brand-muted)' }}>
                Payout amounts shown are winnings only — original bet is returned separately.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl"
              style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
              <Calculator size={32} style={{ color: 'var(--color-brand-muted)' }} />
              <p className="font-semibold" style={{ color: 'var(--color-brand-text)' }}>
                Calculator not configured for this game
              </p>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
