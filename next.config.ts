import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: [
    '@xenova/transformers',
    'onnxruntime-node',
    'sharp',
    // ⚠️ New heavy native/ESM deps that must be externalized from the
    // server bundle. Without this, Vercel bundling fails on tesseract.js
    // (uses native worker threads) and mammoth (uses ESM exports).
    'tesseract.js',
    'mammoth',
    'xlsx',
    'unpdf',
    'pdfjs-dist',
    // ⚠️ Used for per-page PDF rendering in the OCR fallback path.
    // @napi-rs/canvas ships prebuilt native binaries (no system deps),
    // but it must be in serverExternalPackages so Vercel includes the
    // .node native binding in the function bundle instead of trying to
    // bundle it as JS (which fails on the `require(crypto)` shim).
    '@napi-rs/canvas',
  ],
  outputFileTracingIncludes: {
    '/api/upload': [
      './.transformers-cache/**/*',
      './node_modules/onnxruntime-node/bin/**/*',
      './node_modules/@xenova/transformers/**/*',
      './node_modules/tesseract.js/**/*',
      './node_modules/mammoth/**/*',
      './node_modules/xlsx/**/*',
      './node_modules/@napi-rs/canvas/**/*',
    ],
    '/api/chat': [
      './.transformers-cache/**/*',
      './node_modules/onnxruntime-node/bin/**/*',
      './node_modules/@xenova/transformers/**/*',
    ],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
};

export default nextConfig;
