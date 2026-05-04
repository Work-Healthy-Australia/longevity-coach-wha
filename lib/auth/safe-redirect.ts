const AUTH_ROUTE_BLOCK_LIST = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/callback",
]);

export function safeRedirect(
  target: string | null | undefined,
  fallback: string = "/dashboard",
): string {
  if (typeof target !== "string" || target.length === 0) return fallback;
  if (target.charCodeAt(0) !== 47) return fallback;
  if (target.charCodeAt(1) === 47 || target.charCodeAt(1) === 92) return fallback;

  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }

  const queryIndex = target.indexOf("?");
  const hashIndex = target.indexOf("#");
  let pathEnd = target.length;
  if (queryIndex !== -1) pathEnd = queryIndex;
  if (hashIndex !== -1 && hashIndex < pathEnd) pathEnd = hashIndex;
  const pathname = target.slice(0, pathEnd);

  if (AUTH_ROUTE_BLOCK_LIST.has(pathname)) return fallback;

  return target;
}

/**
 * Build a cross-form auth-link href that forwards the original ?redirect=
 * destination, dropping it entirely if the value is unsafe rather than
 * substituting a default. Used by login/signup/verify-email pages so the
 * "Sign in / Create one / Sign up again" links carry the user's intent
 * across forms.
 */
export function authLinkWithRedirect(
  base: string,
  redirect: string | null | undefined,
): string {
  const safeNext = safeRedirect(redirect, "");
  return safeNext ? `${base}?redirect=${encodeURIComponent(safeNext)}` : base;
}
