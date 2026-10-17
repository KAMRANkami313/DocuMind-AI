'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { X, Mail, Lock, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Show clean verification banner
        setSuccessMsg(
          'Account created! A confirmation link has been sent to your email. Please verify your email, then sign in.',
        );
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          onSuccess(data.user);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-indigo-600 p-2">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-base font-bold text-white">
            {isSignUp ? 'Create your Account' : 'Sign in to DocuMind'}
          </h2>
        </div>
        <p className="mb-5 text-xs text-zinc-400">
          {isSignUp
            ? 'Sign up to sync your documents and chat history across all your devices.'
            : 'Sign in to access your cloud documents from anywhere.'}
        </p>

        {successMsg ? (
          <div className="space-y-3 rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Verification Email Sent</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-300">{successMsg}</p>
            <button
              onClick={() => {
                setIsSignUp(false);
                setSuccessMsg('');
              }}
              className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-300">Password</label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pr-4 pl-9 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-red-800/50 bg-red-950/40 p-2.5 text-xs text-red-400">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        )}

        {!successMsg && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
              }}
              className="text-xs text-indigo-400 hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
