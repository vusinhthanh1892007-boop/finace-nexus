import { NextResponse } from "next/server";

export const runtime = "edge";
export const preferredRegion = "global";

export async function GET() {
    const env = typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>);
    const gemini =
        Boolean(env.GEMINI_API_KEY) ||
        Boolean(env.GOOGLE_API_KEY) ||
        Boolean(env.NEXT_PUBLIC_GEMINI_API_KEY);
    const openai =
        Boolean(env.OPENAI_API_KEY) ||
        Boolean(env.NEXT_PUBLIC_OPENAI_API_KEY);

    const active_ai_providers = [gemini ? "gemini" : "", openai ? "openai" : ""].filter(Boolean);

    return NextResponse.json(
        {
            backend: "healthy",
            status: "ok",
            mode: "edge",
            gemini,
            openai,
            gemini_available: gemini,
            openai_available: openai,
            active_ai_providers,
            region: env.VERCEL_REGION || "global",
            timestamp: new Date().toISOString(),
        },
        {
            headers: {
                "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
            },
        },
    );
}
