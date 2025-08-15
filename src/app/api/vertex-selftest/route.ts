export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { analyzeWithVertex } from "@/lib/vertex";

export async function GET() {
    const mockItems = [
        { title: "Sadece test maddesi", link: "https://example.com" },
    ] as any;
    try {
        const text = await analyzeWithVertex(mockItems, { connection: "wireless" });
        return NextResponse.json({ ok: true, text });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
    }
}
