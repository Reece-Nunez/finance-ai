/**
 * Session Security Configuration for Finance App
 * Industry-standard security settings for handling sensitive financial data
 */

export const SESSION_CONFIG = {
  // Session timeout in milliseconds (5 minutes - strict security for finance apps)
  IDLE_TIMEOUT: 5 * 60 * 1000, // 5 minutes

  // Warning before auto-logout (show warning 1 minute before timeout)
  WARNING_BEFORE_TIMEOUT: 1 * 60 * 1000, // 1 minute

  // Activity check interval
  ACTIVITY_CHECK_INTERVAL: 10 * 1000, // 10 seconds (more frequent checks)

  // Extended session for "Remember Me" option (24 hours max - still requires re-auth)
  EXTENDED_SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours

  // Maximum session duration regardless of activity (4 hours)
  ABSOLUTE_SESSION_TIMEOUT: 4 * 60 * 60 * 1000, // 4 hours

  // Events that count as user activity
  ACTIVITY_EVENTS: [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'focus',
  ] as const,

  // Local storage keys for session tracking
  STORAGE_KEYS: {
    LAST_ACTIVITY: 'finance_app_last_activity',
    SESSION_START: 'finance_app_session_start',
    LOGOUT_EVENT: 'finance_app_logout_event',
    REMEMBER_ME: 'finance_app_remember_me',
  },

  // Cookie settings for secure session handling
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    // Session cookies should not have maxAge set for idle timeout
    // Only set maxAge for "Remember Me" functionality
  },
} as const

// Security headers for additional protection
export const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const

// Session state types
export type SessionState = 'active' | 'warning' | 'expired' | 'logged_out'

export interface SessionInfo {
  state: SessionState
  lastActivity: number
  sessionStart: number
  timeUntilWarning: number
  timeUntilExpiry: number
  isExtendedSession: boolean
}
