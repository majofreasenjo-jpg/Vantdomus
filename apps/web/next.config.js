const isProd = process.env.NODE_ENV === 'production';

// SECURITY:
// - 'unsafe-eval' is required by Next.js's React Refresh / HMR in dev only.
//   In production builds it is NOT needed and is removed, so the CSP is
//   meaningfully tighter for the customer-facing build.
// - 'unsafe-inline' on script-src stays for now because Next inlines small
//   bootstrap scripts. Migrating to nonces is the next CSP hardening step
//   (see app/api/proxy and middleware).
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  // CP1d-FAMILY-PILOT-WEB-HARDENING: piloto familiar cerrado — NINGUNA página
  // de la superficie web debe indexarse (aplica a /:path* completo, incluidos
  // /, /login, /hogar/* y /api/*). Complementa robots.txt (Disallow: /) y la
  // metadata robots del layout raíz. Vive en código, no en config del panel.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // OPS-1/M4: geolocation (clima) y microphone (voz para hablarle a Domi)
  // habilitados SOLO para el propio origen. camera sigue deshabilitada (la foto
  // de boletas usa el selector de archivos, no getUserMedia).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "connect-src 'self'",
    ].join('; '),
  },
];

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

if (isProd) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  });
}

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    const cleanTrailingDot = [
      'ceo',
      'dashboard',
      'esg',
      'events',
      'finance',
      'gerencia',
      'health',
      'inbox',
      'login',
      'persons',
      'settings',
      'tasks',
    ];
    return cleanTrailingDot.flatMap((path) => [
      {
        source: `/${path}.`,
        destination: `/${path}`,
        permanent: false,
      },
      {
        source: `/${path}/:rest*.`,
        destination: `/${path}/:rest*`,
        permanent: false,
      },
    ]);
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/dashboard/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/settings/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/finance/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/tasks/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/health/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/persons/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/events/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/inbox/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/ceo/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/gerencia/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/login',
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
