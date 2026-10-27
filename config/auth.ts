/**
 * One password rule for every place a password is chosen: sign-up, the Settings change and the
 * email reset. Sign-in never checks it, so an older account with a shorter password still gets in.
 */
export const PASSWORD_MIN = 8;

/** The message to show when a new password is too short, or null when it is long enough. */
export const passwordProblem = (password: string): string | null =>
  password.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : null;
