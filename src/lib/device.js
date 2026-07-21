// Device capability helpers.
//
// `hasCoarsePointer` is true on touch-first devices (phones/tablets). Used to
// suppress input autofocus there: focusing an input on load pops the on-screen
// keyboard over the table layout before the agent has seen the bet. Desktop
// keeps autofocus so agents can type immediately.
export const hasCoarsePointer =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches
