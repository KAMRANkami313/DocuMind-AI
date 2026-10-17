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
        setSuccessMsg('Account created! A confirmation link has been sent to your email. Please verify your email, then sign in.');
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
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-base font-bold text-white">
            {isSignUp ? 'Create your Account' : 'Sign in to DocuMind'}
          </h2>
        </div>
        <p className="text-xs text-zinc-400 mb-5">
          {isSignUp
            ? 'Sign up to sync your documents and chat history across all your devices.'
            : 'Sign in to access your cloud documents from anywhere.'}
        </p>

        {successMsg ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Verification Email Sent</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">{successMsg}</p>
            <button
              onClick={() => {
                setIsSignUp(false);
                setSuccessMsg('');
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-medium text-zinc-300 mb-1 block">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-300 mb-1 block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/50">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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