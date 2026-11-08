import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isDatabaseConfigured() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    return false;
  }
  const lowered = url.toLowerCase();
  return !(
    lowered.includes("placeholder") ||
    lowered.includes("changeme") ||
    lowered.includes("your-password") ||
    lowered.includes("johndoe") ||
    lowered.includes("randompassword") ||
    lowered.includes("user:password") ||
    lowered.includes("localhost:5432/mydb")
  );
}

export async function pingDatabase(timeoutMs = 8000) {
  if (!isDatabaseConfigured()) {
    return false;
  }
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("db-timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
