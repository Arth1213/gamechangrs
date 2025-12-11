/**
 * Connection code generation and validation utilities
 */

/**
 * Generate a random 6-digit code
 */
export function generateConnectionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if connection code is expired
 */
export function isCodeExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Check if connection code is valid (not expired and matches)
 */
export function isValidConnectionCode(
  code: string,
  storedCode: string,
  expiresAt: string
): boolean {
  if (code !== storedCode) return false;
  if (isCodeExpired(expiresAt)) return false;
  return true;
}

/**
 * Get expiration time (10 minutes from now - for manual code exchange)
 */
export function getCodeExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);
  return expiresAt;
}

/**
 * Get expiration time for email-based verification (24 hours)
 */
export function getEmailCodeExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  return expiresAt;
}

