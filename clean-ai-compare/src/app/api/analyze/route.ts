import { NextResponse } from "next/server";
import { analyzeWithVertex } from "@/lib/vertex";
import type { ProductSearchResult, Criteria } from "@/types";

export async function POST(req: Request) {
  try {
    const { items, criteria } = (await req.json()) as {
      items: ProductSearchResult[];
      criteria?: Criteria;
    };
    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }
    const analysis = await analyzeWithVertex(items, criteria);
    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "analyze failed", message: msg }, { status: 500 });
  }
}
