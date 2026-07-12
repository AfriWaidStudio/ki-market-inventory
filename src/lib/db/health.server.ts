import { prisma } from "./prisma.server";

export async function checkDatabaseHealth(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    return { ok: false, error: message };
  }
}