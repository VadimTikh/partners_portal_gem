import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Health check endpoint for Docker/Kubernetes
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
