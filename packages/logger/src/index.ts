import pino from 'pino';

export interface LoggerOptions {
  name?: string;
  level?: string;
}

/**
 * Konfigurasi Redaction Filter Otomatis untuk Data Sensitif (UU PDP No. 27/2022)
 * Mencegah kebocoran data rahasia/PII ke log server atau observability tool.
 */
const PII_REDACT_PATHS = [
  'password',
  'token',
  'mfaToken',
  'refreshToken',
  'accessToken',
  'nik',
  'personal_nik_encrypted',
  'totpCode',
  'authorization',
  'cookie',
  '*.password',
  '*.token',
  '*.mfaToken',
  '*.refreshToken',
  '*.accessToken',
  '*.nik',
  '*.totpCode',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export function createLogger(options: LoggerOptions = {}) {
  const isDev = process.env.NODE_ENV !== 'production';

  return pino({
    name: options.name ?? 'sica',
    level: options.level ?? (isDev ? 'debug' : 'info'),
    redact: {
      paths: PII_REDACT_PATHS,
      censor: '[REDACTED_BY_SICA_POLICY]',
    },
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = createLogger();
