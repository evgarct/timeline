import { createHash, randomBytes } from "node:crypto";
import { storeMcpToken } from "@/data/repository";
import { getCurrentUserId } from "@/lib/current-user";

function hashToken(token: string) {
  return createHash("sha256").update(`${process.env.MCP_TOKEN_PEPPER ?? "development"}:${token}`).digest("hex");
}

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = `ft_dev_${randomBytes(24).toString("base64url")}`;
  await storeMcpToken(userId, hashToken(token));
  return Response.json({ token }, { status: 201 });
}

