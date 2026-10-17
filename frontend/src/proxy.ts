import { NextResponse, type NextRequest } from "next/server";

// The API validates the session; this only keeps signed-out visitors on /login.
export const SESSION_COOKIE = "fy_session";

export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE) || process.env.NEXT_PUBLIC_USE_MOCKS === "1";
  if (signedIn || request.nextUrl.pathname === "/login") return;
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
