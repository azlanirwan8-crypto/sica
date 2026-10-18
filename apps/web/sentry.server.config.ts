/**
 * Sentry Error Monitoring & APM Configuration — SICA Web Backend
 */
export const sentryServerConfig = {
  dsn: process.env['SENTRY_DSN'] || '',
  environment: process.env['NODE_ENV'] || 'development',
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,

  // Sanitasi data sebelum dikirim ke Sentry (Zero-Trust PII compliance)
  beforeSend(event: Record<string, unknown>) {
    const req = event['request'];
    if (req && typeof req === 'object') {
      const requestRecord = req as Record<string, unknown>;
      const rawHeaders = requestRecord['headers'];
      if (rawHeaders && typeof rawHeaders === 'object') {
        const headers = rawHeaders as Record<string, string>;
        delete headers['authorization'];
        delete headers['cookie'];
      }
    }
    return event;
  },
};
