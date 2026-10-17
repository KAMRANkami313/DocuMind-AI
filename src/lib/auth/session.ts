import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { User } from '@/types';

export interface SessionResult {
  user: User | null;
  accessToken: string | null;
  identifier: string;
}

interface StoredSession {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
    created_at?: string;
  };
}

function extractProjectRef(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.split('.')[0] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function readAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const projectRef = extractProjectRef(env.supabase.url);
  const cookieName = `sb-${projectRef}-auth-token`;

  const direct = cookieStore.get(cookieName)?.value;
  if (direct) return direct;

  const chunks: string[] = [];
  for (let i = 0; i < 10; i++) {
    const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
    if (!chunk) break;
    chunks.push(chunk);
  }
  return chunks.length > 0 ? chunks.join('') : null;
}

function parseSessionCookie(cookieValue: string): StoredSession | null {
  if (!cookieValue) return null;
  if (cookieValue.startsWith('{')) {
    try {
      return JSON.parse(cookieValue) as StoredSession;
    } catch {
      return null;
    }
  }
  if (cookieValue.startsWith('eyJ')) {
    return { access_token: cookieValue };
  }
  return null;
}

async function getAnonymousIdentifier(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return `ip:${ip}`;
  }
  const realIp = headersList.get('x-real-ip');
  if (realIp) return `ip:${realIp}`;
  return 'ip:unknown';
}

export async function resolveSession(): Promise<SessionResult> {
  const anonymousId = await getAnonymousIdentifier();
  const cookieValue = await readAuthCookie();
  if (!cookieValue) {
    return { user: null, accessToken: null, identifier: anonymousId };
  }

  const stored = parseSessionCookie(cookieValue);
  if (!stored?.access_token) {
    return { user: null, accessToken: null, identifier: anonymousId };
  }

  const accessToken = stored.access_token;
  const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return { user: null, accessToken: null, identifier: anonymousId };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? '',
      createdAt: data.user.created_at,
    },
    accessToken,
    identifier: `user:${data.user.id}`,
  };
}

export function createClientForUser(accessToken: string) {
  return createClient(env.supabase.url, env.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}