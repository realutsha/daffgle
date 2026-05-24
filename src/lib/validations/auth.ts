const ADMIN_EMAIL_B64 = "bWFkaHVyemFtdXRzaGFAZ21haWwuY29t"; // "madhurzamutsha@gmail.com"

/**
 * Checks if the provided email is allowed to access the system.
 * Only emails ending with @diu.edu.bd or the admin email are allowed.
 */
export function isEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();

  const adminEmail =
    typeof window !== "undefined"
      ? atob(ADMIN_EMAIL_B64)
      : Buffer.from(ADMIN_EMAIL_B64, "base64").toString("utf-8");

  return lowerEmail.endsWith("@diu.edu.bd") || lowerEmail === adminEmail;
}
