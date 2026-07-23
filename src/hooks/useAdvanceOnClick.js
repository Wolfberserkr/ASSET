import { useEffect } from 'react'

/**
 * useAdvanceOnClick
 *
 * While `active` is true, a click (or tap) anywhere on the page advances the
 * drill to the next item by calling `advance()`. Mirrors the existing keyboard
 * "Enter / Space → next" shortcut so agents can rapid-fire through the trainers
 * and practice questions without hunting for the "Next" button.
 *
 * Clicks that land on a real control (the Next button, reset, expand toggles,
 * links, inputs) are ignored so those keep working normally, and a click that
 * ends a text selection is ignored too. `active` is expected to be gated on the
 * feedback state, so this never fires before the agent has answered.
 */
export default function useAdvanceOnClick(active, advance) {
  useEffect(() => {
    if (!active) return
    const onClick = (e) => {
      // Let genuine interactive controls handle their own clicks.
      if (e.target.closest?.('button, a, input, textarea, select, [role="button"]')) return
      // Don't advance when the click just finished selecting text.
      if (typeof window.getSelection === 'function' && String(window.getSelection())) return
      advance()
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [active, advance])
}
