import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/serper";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

    try {
        const data = await searchProducts(q);
        return NextResponse.json({ shopping_results: data.shopping_results || [] });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: "search failed", message: msg }, { status: 500 });
    }
}
