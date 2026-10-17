import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

if (!env.supabase.url) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
}
if (!env.supabase.serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

export const supabaseAdmin = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export function createClientForUser(accessToken: string) {
  return createClient(env.supabase.url, env.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}