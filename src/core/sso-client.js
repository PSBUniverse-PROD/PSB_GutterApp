/**
 * SSO Client for PSBUniverse Modules
 * Handles cross-subdomain authentication with Core Portal
 *
 * This utility validates the psb_session cookie (set by psbuniverse.com)
 * against the Core Portal's validate-token endpoint, enabling seamless
 * SSO across all psbuniverse.com subdomains.
 */

const CORE_PORTAL_URL = process.env.NEXT_PUBLIC_CORE_PORTAL_URL || "https://www.psbuniverse.com";
const MODULE_ID = process.env.NEXT_PUBLIC_MODULE_ID;

// Normalize core portal URL to avoid redirect issues (strip trailing slash, ensure protocol)
function normalizeBaseUrl(url) {
  const trimmed = String(url || "").trim().replace(/\/$/, "");
  if (!trimmed) return "https://www.psbuniverse.com";
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

const NORMALIZED_CORE_PORTAL_URL = normalizeBaseUrl(CORE_PORTAL_URL);

/**
 * Validate session token with Core Portal via cookie (GET request).
 * The browser automatically sends the psb_session cookie to the Core Portal
 * because it's scoped to Domain=.psbuniverse.com.
 *
 * @returns {Promise<Object|null>} Session payload { userId, email, fullName, modules, roles } or null
 */
export async function validateSessionToken() {
  // ── Primary: Local validation via psb_user_payload cookie ────────────────
  // This cookie is set by Core Portal on login, scoped to .psbuniverse.com,
  // and contains base64-encoded user data. Reading it locally means:
  //   • No cross-origin API call
  //   • No CORS headers needed
  //   • No dependency on Core Portal being reachable
  //   • ~0ms latency vs ~100-300ms for a round-trip
  const localPayload = getPSBUserPayloadFromCookie();
  if (localPayload) {
    return localPayload;
  }

  // ── Fallback: Remote validation via Core Portal API ──────────────────────
  // Used when the payload cookie is missing (e.g., first visit after login
  // before the cookie is set, or cookie was cleared).
  try {
    const response = await fetch(`${NORMALIZED_CORE_PORTAL_URL}/api/auth/validate-token`, {
      method: "GET",
      credentials: "include", // Sends cookies cross-origin (psb_session)
      headers: {
        Accept: "application/json",
      },
      redirect: "manual", // Don't follow redirects — we need to detect them
    });

    // Handle redirects manually to avoid CORS issues
    if (response.status === 301 || response.status === 302 || response.status === 308) {
      const location = response.headers.get("location");
      console.error(
        `[SSO] Redirect detected (${response.status}) to ${location}. ` +
        `Fix: Set NEXT_PUBLIC_CORE_PORTAL_URL to the exact origin that serves the API without redirects. ` +
        `Current value: "${NORMALIZED_CORE_PORTAL_URL}". ` +
        `If your site redirects to www or HTTPS, use that final URL instead.`
      );
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.valid ? data.payload : null;
  } catch (error) {
    console.error("SSO session validation error:", error);
    return null;
  }
}

/**
 * Validate a raw token string against Core Portal (POST request).
 * Useful when you have the token string directly rather than relying on cookies.
 *
 * @param {string} token - The JWT token string to validate
 * @returns {Promise<Object|null>} Session payload or null
 */
export async function validateTokenString(token) {
  if (!token) return null;

  try {
    const response = await fetch(`${NORMALIZED_CORE_PORTAL_URL}/api/auth/validate-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token }),
      redirect: "manual",
    });

    if (response.status === 301 || response.status === 302 || response.status === 308) {
      const location = response.headers.get("location");
      if (location) {
        console.warn(`[SSO] Redirect detected (${response.status}) to ${location}. Update NEXT_PUBLIC_CORE_PORTAL_URL to the final destination.`);
      }
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.valid ? data.payload : null;
  } catch (error) {
    console.error("SSO token validation error:", error);
    return null;
  }
}

/**
 * Check if the current user has access to this module.
 * The module ID is read from NEXT_PUBLIC_MODULE_ID environment variable.
 *
 * @returns {Promise<boolean>} True if user has access to this module
 */
export async function hasModuleAccess() {
  const session = await validateSessionToken();
  if (!session) return false;

  if (!MODULE_ID) {
    console.warn("NEXT_PUBLIC_MODULE_ID is not configured");
    return false;
  }

  // Check if module ID is in the modules array
  return session.modules.includes(MODULE_ID);
}

/**
 * Check if the current user has access to a specific module by ID.
 *
 * @param {string} moduleId - Module ID to check access for
 * @returns {Promise<boolean>} True if user has access
 */
export async function hasSpecificModuleAccess(moduleId) {
  if (!moduleId) return false;

  const session = await validateSessionToken();
  if (!session) return false;

  return session.modules.includes(moduleId);
}

/**
 * Get the current user's session data.
 * Returns the full session payload from the Core Portal.
 *
 * @returns {Promise<Object|null>} Session payload or null if not authenticated
 */
export async function getCurrentSession() {
  return validateSessionToken();
}

/**
 * Perform universal logout across all PSBUniverse modules.
 * Calls the Core Portal's logout endpoint which:
 * 1. Invalidates the session in the database
 * 2. Clears the psb_session cookie
 * 3. Records the logout in the audit trail
 */
export async function logout() {
  try {
    await fetch(`${NORMALIZED_CORE_PORTAL_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      redirect: "manual",
    });
  } catch (error) {
    console.error("SSO logout error:", error);
  }
}

// ── Local Cookie Helpers ────────────────────────────────────────────────────

const USER_PAYLOAD_COOKIE_NAME = 'psb_user_payload';

/**
 * Read and parse the psb_user_payload cookie set by Core Portal.
 * This cookie is scoped to .psbuniverse.com and contains base64-encoded
 * user data, enabling local JWT validation without cross-origin API calls.
 *
 * @returns {Object|null} Session payload { userId, email, fullName, modules, roles } or null
 */
export function getPSBUserPayloadFromCookie() {
  if (typeof document === 'undefined') {
    return null; // Server-side — use getSessionFromRequest() instead
  }

  try {
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${USER_PAYLOAD_COOKIE_NAME}=([^;]*)`));
    if (!match) {
      return null;
    }

    // Browser-native base64 decode (Buffer is Node.js-only)
    // Handles URI-encoded cookie values and missing base64 padding
    let cookieValue = match[2];
    try {
      cookieValue = decodeURIComponent(cookieValue);
    } catch {
      // Not URI-encoded, use raw value
    }

    // Add padding if browser stripped it
    const padded = cookieValue + '='.repeat((4 - cookieValue.length % 4) % 4);

    // Decode base64 → UTF-8 using TextDecoder (handles all Unicode correctly)
    const binaryString = atob(padded);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const payload = JSON.parse(decoded);

    // Basic sanity check
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Clear the local user payload cookie (client-side).
 * Called on logout.
 */
export function clearPSBUserPayloadCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  // Must match the domain used when setting the cookie
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.psbuniverse.com';

  let cookieStr = `${USER_PAYLOAD_COOKIE_NAME}=`;
  cookieStr += `; Path=/`;
  cookieStr += `; Max-Age=0`;
  cookieStr += `; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  cookieStr += `; SameSite=Lax`;

  if (domain) {
    cookieStr += `; Domain=${domain}`;
  }

  document.cookie = cookieStr;
}

/**
 * Redirect user to the Core Portal login page.
 * Uses the redirect validator to prevent open redirect vulnerabilities.
 * Optionally includes a redirect parameter to return after login.
 *
 * @param {string} [returnPath] - Path to return to after login (e.g., "/gutter/dashboard")
 */
export function redirectToLogin(returnPath) {
  const loginUrl = new URL("/login", NORMALIZED_CORE_PORTAL_URL);

  if (returnPath) {
    const trimmed = String(returnPath || "").trim();
    if (trimmed) {
      loginUrl.searchParams.set("redirect", trimmed);
    }
  }

  window.location.href = loginUrl.toString();
}

/**
 * Build a pseudo-auth user object from SSO session payload.
 * This creates a user object compatible with the AuthProvider context,
 * allowing SSO-authenticated users to work with the existing auth system.
 *
 * @param {Object} session - Session payload from validateSessionToken()
 * @returns {Object|null} User object compatible with AuthProvider
 */
export function buildUserFromSSOSession(session) {
  if (!session) return null;

  return {
    id: session.userId || "",
    email: session.email || "",
    user_metadata: {
      full_name: session.fullName || "",
      email: session.email || "",
    },
    // Add the SSO session marker so downstream code can detect SSO auth
    app_metadata: {
      sso_authenticated: true,
    },
  };
}

/**
 * Build a DB user object from SSO session payload.
 * This fills the dbUser slot in AuthProvider context.
 *
 * @param {Object} session - Session payload from validateSessionToken()
 * @returns {Object} DB user object
 */
export function buildDbUserFromSSOSession(session) {
  if (!session) {
    return { email: "", username: "" };
  }

  const name = session.fullName || "";
  const parts = name.split(" ");

  return {
    email: session.email || "",
    username: session.email ? session.email.split("@")[0] : "",
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
    phone: "",
    address: "",
    comp_name: "",
    comp_email: "",
    dept_name: "",
    status_name: "",
  };
}

/**
 * Build roles array from SSO session payload.
 * Converts role IDs to the format expected by AuthProvider.
 *
 * @param {Object} session - Session payload from validateSessionToken()
 * @returns {Array} Roles array
 */
export function buildRolesFromSSOSession(session) {
  if (!session || !Array.isArray(session.roles)) return [];
  return session.roles.map((roleId) => ({
    role_id: roleId,
    role_name: roleId,
    app_id: "",
    app_name: "",
    is_active: true,
  }));
}