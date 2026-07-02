import { createBrowserClient } from '@supabase/ssr'

// Browser client — safe to use in 'use client' components.
// Uses the anon public key (never the service_role key).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
