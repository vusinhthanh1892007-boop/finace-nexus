

import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
    const response = intlMiddleware(request);
    const isDev = process.env.NODE_ENV !== "production";

    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

    if (!isDev) {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload"
        );
    }
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
    response.headers.set("Cross-Origin-Resource-Policy", "same-site");
    response.headers.set("Origin-Agent-Cluster", "?1");

    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "0");

    const scriptSrc = isDev
        ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
        : `script-src 'self' 'nonce-${nonce}'`;
    const connectSrc = isDev
        ? `connect-src 'self' ws: wss: http://localhost:8000 http://localhost:8001 http://localhost:8002 http://localhost:8003`
        : `connect-src 'self'`;
    const csp = [
        `default-src 'self'`,
        scriptSrc,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `font-src 'self' https://fonts.gstatic.com`,
        `img-src 'self' data: https: blob:`,
        connectSrc,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        !isDev ? `upgrade-insecure-requests` : ``,
    ].filter(Boolean).join("; ");

    response.headers.set("Content-Security-Policy", csp);

    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");

    response.headers.set("X-DNS-Prefetch-Control", "off");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()"
    );

    response.headers.set("X-Nonce", nonce);

    return response;
}

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
