import { prisma } from "@axle/db";
import { decrypt } from "@/lib/crypto";

interface DecryptedTokens {
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Retrieve and decrypt OAuth tokens for a given user and provider.
 * Returns null if no token record exists.
 */
export async function getDecryptedTokens(
  userId: string,
  provider: string
): Promise<DecryptedTokens | null> {
  const record = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (!record) return null;

  return {
    accessToken: decrypt(record.accessToken),
    refreshToken: record.refreshToken ? decrypt(record.refreshToken) : null,
  };
}
