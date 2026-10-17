import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { User } from '@/types';

export interface SessionResult {
  user: User | null;
  accessToken: string | null;
  identifier: string;
}

interface AuthCookiePayload {
  user: {
    id: string;
    email?: string;
    created_at?: string;
  } | null;
  access_token: string | null;
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

async function validateToken(token: string): Promise<AuthCookiePayload> {
  const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, access_token: null };
  }
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? undefined,
      created_at: data.user.created_at,
    },
    access_token: token,
  };
}

export async function resolveSession(): Promise<SessionResult> {
  const anonymousId = await getAnonymousIdentifier();
  const token = await readAuthCookie();
  if (!token) {
    return { user: null, accessToken: null, identifier: anonymousId };
  }
  const payload = await validateToken(token);
  if (!payload.user) {
    return { user: null, accessToken: null, identifier: anonymousId };
  }
  const user: User = {
    id: payload.user.id,
    email: payload.user.email ?? '',
    createdAt: payload.user.created_at,
  };
  return {
    user,
    accessToken: payload.access_token,
    identifier: `user:${user.id}`,
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