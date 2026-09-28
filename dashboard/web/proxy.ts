import { NextRequest, NextResponse } from "next/server";
import { isSimAdmin, SIM_COOKIE } from "./lib/sim-admin-auth";

const PUBLIC_SURFACE = process.env.PUBLIC_SURFACE;

export function isAllowedPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/simulate" || pathname.startsWith("/simulate/")) return true;
  if (pathname === "/bear" || pathname.startsWith("/bear/")) return true;
  if (
    pathname === "/simualate-wosui" ||
    pathname.startsWith("/simualate-wosui/")
  ) {
    return true;
  }
  if (pathname === "/healthz") return true;
  if (pathname === "/icon.svg") return true;
  if (pathname.startsWith("/examples/")) return true;
  if (pathname === "/api/ocr-report") return true;
  if (
    pathname === "/api/simulate/runs" ||
    pathname.startsWith("/api/simulate/runs/")
  ) {
    return true;
  }
  return false;
}

export async function proxy(req: NextRequest) {
  if (process.env.WOS_SIM_AUTH_ENABLED === "1" && req.nextUrl.pathname !== "/auth/exchange") {
    if (!await isSimAdmin(req.cookies.get(SIM_COOKIE)?.value)) {
      if (req.method === "GET" && !req.nextUrl.pathname.startsWith("/api/") &&
          req.headers.get("accept")?.includes("text/html")) {
        const login = NextResponse.redirect("https://tools.wos-2277.net/v3/simulator-open.php", 303);
        login.headers.set("Cache-Control", "no-store");
        return login;
      }
      return new NextResponse("Open the simulator from Tools Admin", {
        status: 401,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  }
  if (req.nextUrl.pathname === "/auth/exchange") return NextResponse.next();
  if (PUBLIC_SURFACE !== "simulate") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    const destination = process.env.WOS_SIM_AUTH_ENABLED === "1"
      ? "https://sim.wos-2277.net/simulate"
      : new URL("/simulate", req.url);
    return NextResponse.redirect(destination);
  }

  if (isAllowedPublicPath(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
