import { headers } from 'next/headers';
import { createUserClient } from '@/lib/supabase/server';
import type { User } from '@/types';

export interface SessionResult {
  user: User | null;
  accessToken: string | null;
  identifier: string;
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
  const userClient = await createUserClient();

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { user: null, accessToken: null, identifier: anonymousId };
  }

  const { data: sessionData } = await userClient.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

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