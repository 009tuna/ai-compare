// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { analyzeWithVertex } from "@/lib/vertex";
import type { Product } from "@/lib/enrich";

// Criteria'nın obje olma ihtimaline karşı geniş tip:
type Criteria = string | Record<string, unknown>;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items?: Product[];
      criteria?: Criteria;
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    // criteria'yı string'e indirgeme (obje ise JSON'a çevir, yoksa default)
    const critText =
      typeof body.criteria === "string"
        ? body.criteria
        : body.criteria
          ? JSON.stringify(body.criteria)
          : "Genel değerlendirme";

    const analysis = await analyzeWithVertex(body.items, critText);
    return NextResponse.json(analysis);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "analyze-failed", message: msg }, { status: 500 });
  }
}
