import { NextRequest, NextResponse } from "next/server";
import { callToolsBridge, SIM_COOKIE } from "@/lib/sim-admin-auth";

export async function GET(request: NextRequest) {
  const draft = request.nextUrl.searchParams.get("draft");
  const session = request.cookies.get(SIM_COOKIE)?.value;
  if (!draft || !/^[a-f0-9]{64}$/.test(draft) || !session || !/^[a-f0-9]{64}$/.test(session)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await callToolsBridge("draft", session, draft);
  if (!result?.ok) {
    return NextResponse.json({ error: "draft_unavailable" }, {
      status: result?.status === 401 ? 401 : result?.status === 404 ? 404 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const raw = await result.text();
  if (raw.length > 60000) return NextResponse.json({ error: "invalid_draft" }, { status: 502 });
  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "invalid_draft" }, { status: 502 }); }
  if (!payload || typeof payload !== "object" || !("version" in payload) || payload.version !== 1 ||
      !("simulator" in payload) || (payload.simulator !== "beartrap" && payload.simulator !== "pvp")) {
    return NextResponse.json({ error: "invalid_draft" }, { status: 502 });
  }
  return NextResponse.json(payload, { headers: {
    "Cache-Control": "no-store, private",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  } });
}
