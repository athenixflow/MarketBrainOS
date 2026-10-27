/**
 * One password rule for every place a password is chosen: sign-up, the Settings change and the
 * email reset. Sign-in never checks it, so an older account with a shorter password still gets in.
 */
export const PASSWORD_MIN = 8;

/**
 * Where to go after signing in: the `next` the guard passed, only if it is a path on this site.
 * Anything that could leave the site (another origin, //host, /\host, a scheme) or loop back to
 * /auth is refused, so the parameter cannot be used as an open redirect. Null means "go to /".
 */
export const safeNext = (raw: string | null | undefined): string | null => {
  // Backslashes and control characters have no place in an app path and are how parsers disagree.
  if (!raw || !raw.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const u = new URL(raw, 'https://app.invalid');
    if (u.origin !== 'https://app.invalid') return null;
    // Check what will actually be navigated to: "/.//host" normalises to "//host", "/./auth" to "/auth".
    const out = u.pathname + u.search + u.hash;
    if (out.startsWith('//') || /^\/auth(\/|$)/.test(u.pathname)) return null;
    return out;
  } catch { return null; }
};

/** The name to greet someone by: their first name, else their email's local part without a +tag. */
export const greetingName = (p: { first_name?: string | null; email?: string | null } | null | undefined): string => {
  const first = (p?.first_name || '').trim();
  if (first) return first;
  const local = (p?.email || '').split('@')[0].split('+')[0].trim();
  return local || 'there';
};

/** The message to show when a new password is too short, or null when it is long enough. */
export const passwordProblem = (password: string): string | null =>
  password.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : null;
