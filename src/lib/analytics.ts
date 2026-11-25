// Anonymous product events → Supabase `events` table (insert-only, see supabase/schema.sql).
// If Supabase is not configured the calls are silent no-ops, so the app works without it.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { load } from './storage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null
function db(): SupabaseClient | null {
  if (!url || !key) return null
  if (!client) client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export const analyticsEnabled = Boolean(url && key)

type Props = Record<string, string | number | boolean | null>

/** Never pass emails, free text or nationality here. */
export async function track(name: string, props: Props = {}): Promise<void> {
  const c = db()
  if (!c) {
    if (import.meta.env.DEV) console.debug('[track]', name, props)
    return
  }
  try {
    // no .select(): anon may insert but not read
    await c.from('events').insert({ anon_id: load().anonId, name, props })
  } catch {
    /* analytics must never break the app */
  }
}

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}
