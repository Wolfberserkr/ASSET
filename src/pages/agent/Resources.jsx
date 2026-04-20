import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { Library, ChevronRight, FileText, Video, Calculator } from 'lucide-react'

const GAME_ICONS = {
  'Blackjack':              '🂡🂫',
  'Roulette':               '🎡',
  'Three Card Poker':       '♠️',
  'Let It Ride':            '🤙',
  'Ultimate Texas Hold\'em':'🤠',
}

export default function Resources() {
  const navigate = useNavigate()
  const [games,   setGames]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('games')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setGames(data ?? []); setLoading(false) })
  }, [])

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
          <Library size={18} style={{ color: 'var(--color-brand-gold)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-brand-text)' }}>Resources</h1>
          <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            Game rules, payout charts, and tutorial videos
          </p>
        </div>
      </div>

      {/* What's inside callout */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: FileText,    label: 'Rules & Payouts', desc: 'Full PDF reference' },
          { icon: Video,       label: 'Video Tutorials', desc: 'Game walkthroughs' },
          { icon: Calculator,  label: 'Payout Calculator', desc: 'Instant bet math' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label}
            className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl"
            style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)' }}>
            <Icon size={18} style={{ color: 'var(--color-brand-gold)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--color-brand-text)' }}>{label}</p>
            <p className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Game grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-brand-gold)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => navigate(`/resources/${game.id}`)}
              className="text-left p-5 rounded-2xl flex items-center gap-4 hover-gold active:scale-[0.97] group"
              style={{
                background: 'var(--color-brand-card)',
                border: '1px solid var(--color-brand-border)',
                transition: 'border-color 150ms ease-out, transform 100ms ease-out',
              }}
            >
              <span className="text-3xl shrink-0" role="img" aria-hidden>
                {GAME_ICONS[game.name] ?? '🎲'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--color-brand-text)' }}>
                  {game.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
                  {game.drill_type === 'payout_drill' ? 'Payout drill' : 'Quiz'}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {['Rules', 'Videos', 'Calculator'].map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0"
                style={{ color: 'var(--color-brand-muted)', transition: 'transform 150ms ease-out' }} />
            </button>
          ))}
        </div>
      )}
    </Layout>
  )
}
