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
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/^\/auth(\/|\?|#|$)/.test(raw)) return null;
  try {
    const u = new URL(raw, 'https://app.invalid');
    if (u.origin !== 'https://app.invalid') return null;
    return u.pathname + u.search + u.hash;
  } catch { return null; }
};

/** The message to show when a new password is too short, or null when it is long enough. */
export const passwordProblem = (password: string): string | null =>
  password.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : null;
