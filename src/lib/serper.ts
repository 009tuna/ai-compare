// src/lib/serper.ts
import type { ProductSearchResult } from "@/types";

type SerperShopping = { shopping_results?: ProductSearchResult[] };
type SerperOrganic = { organic?: Array<{ title: string; link: string; snippet?: string }>; };

export async function searchProducts(q: string) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error("SERPER_API_KEY is missing");

    // 1) Shopping araması
    const shopRes = await fetch("https://google.serper.dev/shopping", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 12 }),
        next: { revalidate: 60 },
    });

    if (!shopRes.ok) throw new Error(`Serper shopping failed: ${shopRes.status}`);
    const shopData = (await shopRes.json()) as SerperShopping;

    if (shopData.shopping_results && shopData.shopping_results.length > 0) {
        return { shopping_results: shopData.shopping_results.map((x) => ({ ...x, source: "shopping" })) };
    }

    // 2) Fallback: web arama
    const webRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 10 }),
        next: { revalidate: 60 },
    });

    if (!webRes.ok) throw new Error(`Serper web search failed: ${webRes.status}`);
    const webData = (await webRes.json()) as SerperOrganic;

    const mapped: ProductSearchResult[] = (webData.organic || []).map((o, i) => ({
        title: o.title,
        link: o.link,
        price: undefined,
        source: "web",
        position: i + 1,
        thumbnail: undefined,
    }));

    return { shopping_results: mapped };
}
