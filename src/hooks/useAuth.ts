import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ensureSignedIn } from '../firebase/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn()
      .then(setUser)
      .catch((err) => setError(err.message ?? 'Failed to sign in'));
  }, []);

  return { user, error, loading: !user && !error };
}
