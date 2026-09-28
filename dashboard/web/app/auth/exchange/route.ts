import { NextRequest, NextResponse } from "next/server";
import { callToolsBridge, SIM_COOKIE } from "@/lib/sim-admin-auth";

export async function GET(request: NextRequest) {
  if (process.env.WOS_SIM_AUTH_ENABLED !== "1") {
    return new NextResponse("Simulator access is not ready", { status: 503 });
  }
  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket || !/^[a-f0-9]{64}$/.test(ticket)) {
    return new NextResponse("Invalid access ticket", { status: 401 });
  }
  const result = await callToolsBridge("exchange", ticket);
  if (!result?.ok) {
    return new NextResponse("Access ticket expired or unavailable", {
      status: result?.status === 401 ? 401 : 503,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
  const data: unknown = await result.json().catch(() => null);
  if (!data || typeof data !== "object" || !("session" in data) ||
      typeof data.session !== "string" || !/^[a-f0-9]{64}$/.test(data.session)) {
    return new NextResponse("Simulator access is unavailable", { status: 503 });
  }
  // Plesk forwards requests to Next through localhost:3000. Never return that
  // internal origin to the browser after exchanging a ticket.
  const response = NextResponse.redirect("https://sim.wos-2277.net/simulate", 303);
  response.cookies.set(SIM_COOKIE, data.session, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 43200,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
