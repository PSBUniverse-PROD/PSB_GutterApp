/**
 * Token Refresh Endpoint
 * POST /api/auth/refresh-token
 * Refreshes expiring or valid tokens
 *
 * Note: CORS headers are no longer needed. All SSO validation is done
 * locally via the psb_user_payload cookie (scoped to .psbuniverse.com).
 */

import { NextResponse } from 'next/server';
import { verifyToken, getTokenTimeRemaining, generateToken } from '@/core/auth/jwt.utils';
import { getPSBSessionCookieFromRequest, getPSBSessionCookieHeader } from '@/core/auth/cookies.utils';
import { createUserSession } from '@/core/auth/session.service';
import { getSupabaseAdmin } from '@/core/supabase/admin';

// Refresh token if less than 2 hours remaining
const REFRESH_THRESHOLD = 2 * 60 * 60 * 1000;

export async function POST(request) {
  try {
    // Get token from request
    let token = getPSBSessionCookieFromRequest(request);

    // Fallback: check request body
    if (!token) {
      const body = await request.json();
      token = body?.token;
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No session token found' },
        { status: 401 }
      );
    }

    // Verify token
    let payload;
    try {
      payload = await verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check time remaining
    const timeRemaining = getTokenTimeRemaining(payload);

    // If more than threshold remaining, return existing token
    if (timeRemaining > REFRESH_THRESHOLD) {
      return NextResponse.json(
        {
          success: true,
          token,
          refreshed: false,
          expiresAt: payload.expiresAt,
        },
        { status: 200 }
      );
    }

    // Refresh token - generate new token with same data
    const newToken = await generateToken(
      {
        userId: payload.userId,
        authUserId: payload.authUserId,
        email: payload.email,
        fullName: payload.fullName,
        modules: payload.modules,
        roles: payload.roles,
      },
      '24h'
    );

    // Create response with new Set-Cookie header
    const response = NextResponse.json(
      {
        success: true,
        token: newToken,
        refreshed: true,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      { status: 200 }
    );

    // Set new session cookie
    response.headers.set('Set-Cookie', getPSBSessionCookieHeader(newToken));

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}