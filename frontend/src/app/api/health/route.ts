import { NextResponse } from "next/server";

export const runtime = "edge";
export const preferredRegion = "global";

export async function GET() {
    const gemini =
        Boolean(process.env.GEMINI_API_KEY) ||
        Boolean(process.env.GOOGLE_API_KEY) ||
        Boolean(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    const openai =
        Boolean(process.env.OPENAI_API_KEY) ||
        Boolean(process.env.NEXT_PUBLIC_OPENAI_API_KEY);

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
            region: process.env.VERCEL_REGION || "global",
            timestamp: new Date().toISOString(),
        },
        {
            headers: {
                "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
            },
        },
    );
}
