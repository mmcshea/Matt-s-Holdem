import { useEffect, useState } from 'react';
import { ensureSignedIn } from '../supabase/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn()
      .then(setUser)
      .catch((err) => setError(err.message ?? 'Failed to sign in'));
  }, []);

  return { user, error, loading: !user && !error };
}
