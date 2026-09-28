import "server-only";

export const SIM_COOKIE = "__Host-wos_sim_session";

type BridgeAction = "exchange" | "verify" | "draft";

export async function callToolsBridge(action: BridgeAction, token: string, draft?: string): Promise<Response | null> {
  const url = process.env.WOS_TOOLS_AUTH_URL;
  const secret = process.env.WOS_SIM_BRIDGE_SECRET;
  if (!url || !url.startsWith("https://") || !secret || secret.length < 32) return null;
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Simulator-Bridge": secret,
      },
      body: JSON.stringify({ action, token, ...(draft ? { draft } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

export async function isSimAdmin(token: string | undefined): Promise<boolean> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const result = await callToolsBridge("verify", token);
  if (!result?.ok) return false;
  const data: unknown = await result.json().catch(() => null);
  return data !== null && typeof data === "object" &&
    "authorized" in data && data.authorized === true;
}
