import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Online mode is optional - pass-and-play must keep working with zero
// Supabase setup. Initialization failures surface as a normal rejected
// promise from ensureSignedIn() instead of crashing the module.
let client: SupabaseClient | null = null;
let initError: string | null = null;

if (!url || !anonKey) {
  initError = 'Supabase is not configured yet (missing VITE_SUPABASE_* env vars).';
} else {
  client = createClient(url, anonKey);
}

export function getClient(): SupabaseClient {
  if (!client) throw new Error(initError ?? 'Supabase is not configured');
  return client;
}

// Resolves once we have a signed-in (anonymous) user, signing in if needed.
// Each device gets a stable session persisted by the Supabase client across
// reloads (localStorage-backed by default).
export async function ensureSignedIn(): Promise<{ uid: string }> {
  if (!client) throw new Error(initError ?? 'Supabase is not configured');
  const { data: existing } = await client.auth.getSession();
  if (existing.session?.user) {
    return { uid: existing.session.user.id };
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  const user = data.user as User;
  return { uid: user.id };
}
