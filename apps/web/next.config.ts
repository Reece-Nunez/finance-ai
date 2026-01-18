import type { NextConfig } from "next";

// Content Security Policy
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://logo.clearbit.com https://www.google.com https://*.stripe.com;
  font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.anthropic.com https://cdn.plaid.com https://production.plaid.com https://sandbox.plaid.com;
  frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://cdn.plaid.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, ' ').trim();

const securityHeaders = [
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: cspHeader,
  },
  // Prevent clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Control referrer information
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // HTTP Strict Transport Security
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Permissions Policy (formerly Feature-Policy)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
  // Prevent XSS attacks
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',

  // Fix for Amplify bundling issue with import-in-the-middle (used by Sentry/OpenTelemetry)
  serverExternalPackages: [
    'import-in-the-middle',
    'require-in-the-middle',
    '@opentelemetry/instrumentation',
    '@opentelemetry/api',
    '@opentelemetry/core',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/resources',
    '@opentelemetry/context-async-hooks',
    '@sentry/node',
    '@sentry/opentelemetry',
  ],

  // Performance: Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons/**',
      },
    ],
    // Performance: Modern image formats
    formats: ['image/avif', 'image/webp'],
    // Performance: Cache images for 7 days
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Performance: Cache static API responses
      {
        source: '/api/subscription',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=3600, stale-while-revalidate=1800' },
        ],
      },
      {
        source: '/api/accounts',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=60' },
        ],
      },
    ];
  },
};

export default nextConfig;
