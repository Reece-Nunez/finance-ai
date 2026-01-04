export const SESSION_CONFIG = {
  // Idle timeout (5 minutes)
  IDLE_TIMEOUT: 5 * 60 * 1000,

  // Show warning 1 minute before timeout
  WARNING_BEFORE_TIMEOUT: 1 * 60 * 1000,

  // Check activity every 10 seconds
  ACTIVITY_CHECK_INTERVAL: 10 * 1000,

  // Extended session timeout (24 hours with "Remember Me")
  EXTENDED_SESSION_TIMEOUT: 24 * 60 * 60 * 1000,

  // Absolute max session time (4 hours)
  ABSOLUTE_SESSION_TIMEOUT: 4 * 60 * 60 * 1000,
} as const

export const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'focus',
] as const

export const STORAGE_KEYS = {
  LAST_ACTIVITY: 'sterling_last_activity',
  SESSION_START: 'sterling_session_start',
  LOGOUT_EVENT: 'sterling_logout_event',
  REMEMBER_ME: 'sterling_remember_me',
  AUTH_TOKEN: 'sterling_auth_token',
} as const
