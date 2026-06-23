import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '5000'), 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  // Not required at startup — validated in Phase 3 when auth routes are registered
  jwtAccessSecret: optionalEnv('JWT_ACCESS_SECRET', ''),
  jwtRefreshSecret: optionalEnv('JWT_REFRESH_SECRET', ''),
  jwtAccessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '30d'),
  corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:3000'),
} as const;

export function validateAuthSecrets(): void {
  if (!env.jwtAccessSecret) throw new Error('Missing required environment variable: JWT_ACCESS_SECRET');
  if (!env.jwtRefreshSecret) throw new Error('Missing required environment variable: JWT_REFRESH_SECRET');
}
