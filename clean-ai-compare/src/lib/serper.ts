import { ProductSearchResult } from "@/types";

type SerperResponse = { shopping_results?: ProductSearchResult[] };

export async function searchProducts(q: string): Promise<SerperResponse> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error("SERPER_API_KEY is missing");

    const res = await fetch("https://google.serper.dev/shopping", {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 12 }),
        next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Serper failed: ${res.status}`);
    const data = (await res.json()) as SerperResponse;
    return { shopping_results: data.shopping_results ?? [] };
}
