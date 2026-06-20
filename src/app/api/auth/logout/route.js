/**
 * Authentication Logout Endpoint
 * POST /api/auth/logout
 * Invalidates session and clears cookies
 *
 * Note: CORS headers are no longer needed. All SSO validation is done
 * locally via the psb_user_payload cookie (scoped to .psbuniverse.com).
 */

import { NextResponse } from 'next/server';
import { invalidateSession } from '@/core/auth/session.service';
import { getClearPSBSessionCookieHeader, getClearPSBUserPayloadCookieHeader, getPSBSessionCookieFromRequest } from '@/core/auth/cookies.utils';

export async function POST(request) {
  try {
    // Get token from request
    const token = getPSBSessionCookieFromRequest(request);

    // Invalidate session in database
    if (token) {
      await invalidateSession(token);
    }

    // Create response with cleared cookie
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear session cookie
    response.headers.set('Set-Cookie', getClearPSBSessionCookieHeader());

    // Clear shared payload cookie (use append to avoid overwriting)
    response.headers.append('Set-Cookie', getClearPSBUserPayloadCookieHeader());

    return response;
  } catch (error) {
    console.error('Logout endpoint error:', error);

    // Still clear the cookie even if database operation fails
    const response = NextResponse.json(
      { success: true, message: 'Logout complete' },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', getClearPSBSessionCookieHeader());

    // Clear shared payload cookie (use append to avoid overwriting)
    response.headers.append('Set-Cookie', getClearPSBUserPayloadCookieHeader());

    return response;
  }
}