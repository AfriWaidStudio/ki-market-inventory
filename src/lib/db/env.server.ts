export function validateDatabaseEnv(): { ok: boolean; error?: string } {
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL is not configured." };
  }
  return { ok: true };
}