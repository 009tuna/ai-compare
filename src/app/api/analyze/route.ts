// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { analyzeWithVertex, type Product } from "@/lib/vertex";
import { normalizeToProducts, toCriteriaString } from "@/lib/normalize";

export async function POST(req: Request) {
  try {
    const body: any = await req.json();

    // items → Product[]
    const rawItems: any[] = Array.isArray(body?.items) ? body.items : [];
    const items: Product[] = normalizeToProducts(rawItems);

    const criteriaStr = toCriteriaString(body?.criteria);

    if (!items.length) {
      return NextResponse.json(
        {
          analysis:
            "Uygun ürün listesi gelmedi veya arama sonuçsuz. Arama ifadesini biraz genişlet ya da marka/model adı ekle.",
        },
        { status: 200 }
      );
    }

    const analysis = await analyzeWithVertex(items, criteriaStr);
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "analyze failed", message: msg }, { status: 500 });
  }
}
