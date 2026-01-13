/**
 * Database queries index
 *
 * Re-exports all query modules for easier imports.
 */

// PostgreSQL queries (Supabase)
export * from './users';
export * from './sessions';
export * from './course-requests';

// MySQL queries (Magento)
export * from './courses';
export * from './dates';
export * from './partners';
