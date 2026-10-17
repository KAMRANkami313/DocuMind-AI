'use client';

import * as React from 'react';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface SupabaseAuthUser {
  id: string;
  email: string;
  created_at?: string;
}

function toUser(raw: SupabaseAuthUser | null | undefined): User | null {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    createdAt: raw.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAuthOpen, setIsAuthOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!mounted) return;
      setUser(toUser(currentUser as SupabaseAuthUser | null));
      setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session?.user as SupabaseAuthUser | undefined));
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const openAuth = React.useCallback(() => setIsAuthOpen(true), []);
  const closeAuth = React.useCallback(() => setIsAuthOpen(false), []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setIsAuthOpen(false);
  }, []);

  const signUp = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthOpen,
      openAuth,
      closeAuth,
      signIn,
      signUp,
      signOut,
    }),
    [user, isLoading, isAuthOpen, openAuth, closeAuth, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}