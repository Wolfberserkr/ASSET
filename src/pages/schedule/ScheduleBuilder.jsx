import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { mount } from '../../features/schedule/builderApp'
import template from '../../features/schedule/builderTemplate'
import {
  loadWorkspace, saveWorkspace, publishSchedule, unpublishSchedule, listPublished,
} from '../../features/schedule/scheduleApi'
import '../../features/schedule/fonts'
import '../../features/schedule/builder.css'

// Team Schedule Builder — Director + Supervisor only (route guard in App.jsx; RLS enforces it too).
// The builder itself is the reference page's script (features/schedule/builderApp.js), mounted
// into this container; React only loads the shared workspace first and hands it over.
export default function ScheduleBuilder() {
  const { profile } = useAuth()
  const rootRef = useRef(null)
  const [initial, setInitial] = useState(null) // { state, version } | { error }

  useEffect(() => {
    let alive = true
    loadWorkspace().then(
      (w) => { if (alive) setInitial({ state: w?.state ?? null, version: w?.version ?? null }) },
      (error) => { if (alive) setInitial({ error }) },
    )
    return () => { alive = false }
  }, [])

  const canUnpublish = profile?.role === 'director'

  useEffect(() => {
    const el = rootRef.current
    if (!initial || !el) return
    el.innerHTML = template
    const unmount = mount(el, {
      initial,
      storage: { load: loadWorkspace, save: saveWorkspace },
      publish: publishSchedule,
      unpublish: unpublishSchedule,
      listPublished,
      canUnpublish,
    })
    return () => { unmount(); el.innerHTML = '' }
  }, [initial, canUnpublish])

  return (
    <Layout wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--color-brand-cyan)' }}
        >
          <CalendarDays size={15} /> Published schedule
        </Link>
      </div>
      {!initial && (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-brand-cyan)' }}
          />
        </div>
      )}
      <div ref={rootRef} className="schedule-builder" hidden={!initial} />
    </Layout>
  )
}
