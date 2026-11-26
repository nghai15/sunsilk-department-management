import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong frontend/.env')
}

const localHosts = ['localhost', '127.0.0.1', '[::1]']
export const supabaseUrl = import.meta.env.DEV && localHosts.includes(new URL(url).hostname) && !localHosts.includes(window.location.hostname)
  ? `${window.location.origin}/supabase`
  : url

export const supabase = createClient(supabaseUrl, key)
