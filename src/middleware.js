import { NextResponse } from "next/server";

export function middleware(req) {
    const { pathname } = req.nextUrl;
    const hasSession = req.cookies.get("app_session");

    // ha már be vagy lépve és a /signin-t nyitnád → /
    if (pathname === "/signin" && hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.search = ""; // ne legyen ?from=...
        return NextResponse.redirect(url);
    }

    // publikus útvonalak
    const PUBLIC = ["/signin", "/_next", "/favicon.ico", "/assets", "/public"];
    const isPublic = PUBLIC.some(p => pathname.startsWith(p));

    // ha nem vagy belépve és nem publikus oldal → /signin
    if (!hasSession && !isPublic) {
        const url = req.nextUrl.clone();
        url.pathname = "/signin";
        url.search = ""; // tiszta URL
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next|favicon.ico|assets|public|api).*)"],
};
