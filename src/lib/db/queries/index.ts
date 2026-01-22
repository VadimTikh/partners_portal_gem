/**
 * Database queries index
 *
 * Re-exports all query modules for easier imports.
 */

// PostgreSQL queries (Supabase)
export * from './users';
export * from './sessions';
export * from './course-requests';
export * from './activity-logs';
export * from './app-logs';
export * from './customer-numbers';
export * from './bookings';
export * from './helpdesk';

// MySQL queries (Magento)
export * from './courses';
export * from './dates';
export * from './partners';
export * from './orders';
