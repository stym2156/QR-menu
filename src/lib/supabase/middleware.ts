import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
