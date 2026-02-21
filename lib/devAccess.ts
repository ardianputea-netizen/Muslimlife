const parseAllowedEmails = (value: string | undefined) =>
  (value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const canAccessDeveloperTools = (email?: string | null) => {
  if (import.meta.env.DEV) return true;

  const allowedEmails = parseAllowedEmails(import.meta.env.VITE_DEV_HEALTH_EMAILS);
  if (!allowedEmails.length) return false;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  return normalizedEmail.length > 0 && allowedEmails.includes(normalizedEmail);
};
