function requireEnv(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    if (typeof window === 'undefined') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return '';
  }
  return value.trim();
}

function optionalEnv(value: string | undefined, fallback = ''): string {
  if (!value || value.trim() === '') return fallback;
  return value.trim();
}

const isServer = typeof window === 'undefined';

export const env = {
  app: {
    name: optionalEnv(process.env.NEXT_PUBLIC_APP_NAME, 'DocuMind AI'),
    url: optionalEnv(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000'),
  },
  supabase: {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: isServer
      ? requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
      : '',
  },
  groq: {
    apiKey: isServer ? requireEnv('GROQ_API_KEY', process.env.GROQ_API_KEY) : '',
  },
  upstash: {
    redisRestUrl: optionalEnv(process.env.UPSTASH_REDIS_REST_URL),
    redisRestToken: optionalEnv(process.env.UPSTASH_REDIS_REST_TOKEN),
  },
  sentry: {
    dsn: optionalEnv(process.env.SENTRY_DSN),
  },
  posthog: {
    key: optionalEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    host: optionalEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  },
  stripe: {
    secretKey: optionalEnv(process.env.STRIPE_SECRET_KEY),
    webhookSecret: optionalEnv(process.env.STRIPE_WEBHOOK_SECRET),
  },
} as const;

export function assertServerEnv(): void {
  if (!isServer) {
    throw new Error('assertServerEnv called on the client');
  }
  const missing: string[] = [];
  if (!env.supabase.url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.supabase.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.groq.apiKey) missing.push('GROQ_API_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing server environment variables: ${missing.join(', ')}`);
  }
}
