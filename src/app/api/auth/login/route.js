/**
 * Authentication Login Endpoint
 * POST /api/auth/login
 * Generates session token after Supabase authentication
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/core/supabase/admin';
import { createUserSession } from '@/core/auth/session.service';
import { getPSBSessionCookieHeader, getPSBUserPayloadCookieHeader } from '@/core/auth/cookies.utils';
import { getCORSHeaders } from '@/core/auth/cors.utils';

export async function POST(request) {
  try {
    const body = await request.json();
    const { accessToken } = body;
    const corsHeaders = getCORSHeaders(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify the token with Supabase
    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Invalid or expired access token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const authUser = authData.user;

    // Resolve database user
    let dbUser = null;
    let roles = [];
    let moduleIds = [];
    let roleIds = [];

    try {
      // Try by auth_user_id first
      const { data: userByAuthId } = await supabaseAdmin
        .from('psb_s_user')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (userByAuthId) {
        dbUser = userByAuthId;
      } else if (authUser.email) {
        // Fallback by email
        const { data: userByEmail } = await supabaseAdmin
          .from('psb_s_user')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();

        if (userByEmail) {
          dbUser = userByEmail;

          // Auto-sync auth_user_id
          if (!userByEmail.auth_user_id) {
            await supabaseAdmin
              .from('psb_s_user')
              .update({ auth_user_id: authUser.id })
              .eq('user_id', userByEmail.user_id);
          }
        }
      }

      // Load user roles
      if (dbUser) {
        const { data: userRoles } = await supabaseAdmin
          .from('psb_m_userapproleaccess')
          .select('*')
          .eq('user_id', dbUser.user_id)
          .eq('is_active', true);

        roles = userRoles || [];
        moduleIds = [...new Set(roles.map((r) => r.app_id).filter(Boolean))];
        roleIds = [...new Set(roles.map((r) => r.role_id).filter(Boolean))];
      }
    } catch (error) {
      console.error('Database lookup error:', error);
      // Continue with minimal user data
    }

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in system' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Create session
    const session = await createUserSession(authUser, dbUser, roles);

    // Create response with Set-Cookie header
    const response = NextResponse.json(
      {
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          id: dbUser.user_id,
          email: authUser.email,
          name: `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim(),
        },
      },
      { status: 200, headers: corsHeaders }
    );

    // Set secure session cookie (HttpOnly — not readable by JS, used for API auth)
    response.headers.set('Set-Cookie', getPSBSessionCookieHeader(session.token));

    // Set shared payload cookie (readable by JS on all subdomains — enables local JWT validation)
    response.headers.set('Set-Cookie', getPSBUserPayloadCookieHeader({
      userId: dbUser.user_id,
      email: authUser.email,
      fullName: `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim(),
      modules: moduleIds,
      roles: roleIds,
    }));

    return response;
  } catch (error) {
    console.error('Login endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getCORSHeaders(request) }
    );
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
