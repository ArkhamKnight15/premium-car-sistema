import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isConfigured } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/auth/", "/configurar"];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!isConfigured()) {
    if (path.startsWith("/configurar")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/configurar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida o token junto ao Supabase (não confia apenas no cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" || path === "/dashboard" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
