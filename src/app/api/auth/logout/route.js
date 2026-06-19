/**
 * Authentication Logout Endpoint
 * POST /api/auth/logout
 * Invalidates session and clears cookies
 */

import { NextResponse } from 'next/server';
import { invalidateSession } from '@/core/auth/session.service';
import { getClearPSBSessionCookieHeader, getClearPSBUserPayloadCookieHeader, getPSBSessionCookieFromRequest } from '@/core/auth/cookies.utils';
import { getCORSHeaders } from '@/core/auth/cors.utils';

export async function POST(request) {
  try {
    // Get token from request
    const token = getPSBSessionCookieFromRequest(request);
    const corsHeaders = getCORSHeaders(request);

    // Invalidate session in database
    if (token) {
      await invalidateSession(token);
    }

    // Create response with cleared cookie
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200, headers: corsHeaders }
    );

    // Clear session cookie
    response.headers.set('Set-Cookie', getClearPSBSessionCookieHeader());

    // Clear shared payload cookie
    response.headers.set('Set-Cookie', getClearPSBUserPayloadCookieHeader());

    return response;
  } catch (error) {
    console.error('Logout endpoint error:', error);

    // Still clear the cookie even if database operation fails
    const response = NextResponse.json(
      { success: true, message: 'Logout complete' },
      { status: 200, headers: getCORSHeaders(request) }
    );

    response.headers.set('Set-Cookie', getClearPSBSessionCookieHeader());

    // Clear shared payload cookie
    response.headers.set('Set-Cookie', getClearPSBUserPayloadCookieHeader());

    return response;
  }
}

export async function OPTIONS(request) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: getCORSHeaders(request),
    }
  );
}
