/**
 * Sanitizes post-login redirect targets (?next= or ?redirect=) to prevent open redirects.
 * Only relative internal application paths starting with a single '/' are permitted.
 */
export function resolveSafeRedirectPath(
  rawTarget: string | null | undefined
): string {
  if (!rawTarget) return "/";
  const trimmed = rawTarget.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    trimmed.includes("://")
  ) {
    return "/";
  }
  if (
    trimmed === "/login" ||
    trimmed.startsWith("/login?") ||
    trimmed === "/register" ||
    trimmed.startsWith("/register?")
  ) {
    return "/";
  }
  return trimmed;
}
