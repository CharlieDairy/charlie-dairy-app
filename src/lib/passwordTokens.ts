import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const INVITE_HOURS = 72;
export const RESET_HOURS = 24;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Creates a one-time link token for a user and returns the RAW token (only
 * its hash is stored). Any earlier unused link for the same user is revoked,
 * so there's only ever one live link per person.
 */
export async function issuePasswordToken(userId: string, purpose: "INVITE" | "RESET"): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const hours = purpose === "INVITE" ? INVITE_HOURS : RESET_HOURS;
  await prisma.passwordToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordToken.create({
    data: { userId, tokenHash: hashToken(raw), purpose, expiresAt: new Date(Date.now() + hours * 3_600_000) },
  });
  return raw;
}

/** The token's user if the link is still valid (exists, unused, unexpired, active account), else null. */
export async function findValidToken(raw: string) {
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  const token = await prisma.passwordToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, name: true, username: true, active: true } } },
  });
  if (!token || token.usedAt || token.expiresAt < new Date() || !token.user.active) return null;
  return token;
}

/** Absolute link for a raw token, built from the incoming request's host. */
export async function passwordLink(raw: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/set-password/${raw}`;
}
