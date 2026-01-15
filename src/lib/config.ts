/**
 * Centralized environment configuration with validation
 * All environment variables are accessed through this module
 */

// Check if we're in build mode (Next.js builds run on server without full env)
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  // Don't throw during build phase - env vars might not be set yet
  if (required && !value && !isBuildPhase) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

function getEnvVarInt(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    // Don't throw during build phase
    if (!isBuildPhase) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return 0;
  }
  return parseInt(value, 10);
}

export const config = {
  // Application
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  appUrl: getEnvVar('APP_URL', false) || 'http://localhost:3000',

  // PostgreSQL (Supabase) - for users, sessions, course requests
  database: {
    url: getEnvVar('DATABASE_URL'),
  },

  // MySQL (Magento) - for courses, dates, products
  magento: {
    host: getEnvVar('MAGENTO_DB_HOST'),
    port: getEnvVarInt('MAGENTO_DB_PORT', 3306),
    user: getEnvVar('MAGENTO_DB_USER'),
    password: getEnvVar('MAGENTO_DB_PASSWORD'),
    database: getEnvVar('MAGENTO_DB_NAME'),
  },

  // Authentication
  auth: {
    jwtSecret: getEnvVar('JWT_SECRET'),
    sessionExpiryDays: 14,
  },

  // Email (SendGrid)
  email: {
    sendgridApiKey: getEnvVar('SENDGRID_API_KEY'),
    from: getEnvVar('EMAIL_FROM', false) || 'bestellung@miomente.de',
    fromName: getEnvVar('EMAIL_FROM_NAME', false) || 'Miomente Partner-Portal',
    // In development, override all email recipients
    devOverride: process.env.DEV_EMAIL_OVERRIDE || null,
  },

  // Odoo (Support tickets)
  odoo: {
    url: getEnvVar('ODOO_URL', false),
    db: getEnvVar('ODOO_DB', false),
    userId: getEnvVarInt('ODOO_USER_ID', 0),
    apiKey: getEnvVar('ODOO_API_KEY', false),
  },
} as const;

// Validate configuration on module load (server-side only)
if (typeof window === 'undefined') {
  // Basic validation - will throw if required vars are missing
  try {
    // These are required for the app to function
    if (!config.database.url) {
      console.warn('DATABASE_URL not set - database features will not work');
    }
    if (!config.auth.jwtSecret) {
      console.warn('JWT_SECRET not set - authentication will not work');
    }
  } catch (error) {
    console.error('Configuration error:', error);
  }
}

export type Config = typeof config;
