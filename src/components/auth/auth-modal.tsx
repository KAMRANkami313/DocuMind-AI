'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabase/client';
import { X, Mail, Lock, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import type { User } from '@/types';
import { cn } from '@/lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
}

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg(
          'Account created! A confirmation link has been sent to your email. Please verify your email, then sign in.',
        );
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          const user: User = {
            id: (data.user as SupabaseAuthUser).id,
            email: (data.user as SupabaseAuthUser).email ?? '',
          };
          onSuccess?.(user);
          onClose();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-md p-6"
      closeOnBackdrop
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-surface-2 transition cursor-pointer"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-primary rounded-lg">
          <Sparkles className="w-4 h-4 text-primary-fg" />
        </div>
        <h2 className="text-base font-bold text-fg">
          {isSignUp ? 'Create your Account' : 'Sign in to DocuMind'}
        </h2>
      </div>
      <p className="text-xs text-fg-muted mb-5">
        {isSignUp
          ? 'Sign up to sync your documents and chat history across all your devices.'
          : 'Sign in to access your cloud documents from anywhere.'}
      </p>

      {successMsg ? (
        <div className="p-4 bg-success-soft border border-success/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-success">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>Verification Email Sent</span>
          </div>
          <p className="text-xs text-fg leading-relaxed">{successMsg}</p>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setSuccessMsg('');
            }}
            className="w-full py-2 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleAuth} className="space-y-3.5">
          <div>
            <label className="text-[11px] font-medium text-fg mb-1 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-fg-subtle absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary transition"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-fg mb-1 block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-fg-subtle absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary transition"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-danger bg-danger-soft p-2.5 rounded-lg border border-danger/30">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-2.5 bg-primary hover:bg-primary-hover text-primary-fg rounded-xl text-xs font-semibold',
              'flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer',
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      )}

      {!successMsg && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
            }}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </button>
        </div>
      )}
    </Dialog>
  );
}