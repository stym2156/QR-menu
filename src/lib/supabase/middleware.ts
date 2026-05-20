import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "../env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() can throw "Invalid Refresh Token" if the auth cookie is stale
  // (e.g. user signed out elsewhere, project was reset). Treat as logged-out
  // and clear the broken cookies so the client doesn't loop on it.
  let user: { id: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
    // Best-effort: clear any sb- auth cookies on the response so the next
    // request starts clean.
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) {
        response.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  const url = request.nextUrl;
  const isDashboard = url.pathname.startsWith("/dashboard");
  const isAuthPage = url.pathname === "/login" || url.pathname === "/signup";

  if (isDashboard && !user) {
    const redirect = url.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  if (isAuthPage && user) {
    const redirect = url.clone();
    redirect.pathname = "/dashboard";
    return NextResponse.redirect(redirect);
  }

  return response;
}
