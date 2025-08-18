// src/lib/normalize.ts
import type { Product } from "@/lib/vertex";
import { parsePriceTRY } from "@/lib/enrich";

type AnyItem = any;

export function toCriteriaString(val: unknown): string {
    if (typeof val === "string") return val;
    try {
        return val == null ? "" : JSON.stringify(val);
    } catch {
        return "";
    }
}

/** Gelen diziyi (ProductSearchResult, organic/shopping item vs.) tek tip Product[]'a dönüştürür. */
export function normalizeToProducts(items: AnyItem[]): Product[] {
    if (!Array.isArray(items)) return [];

    const out: Product[] = [];

    for (const it of items) {
        const name: string =
            (it?.name as string) ||
            (it?.title as string) ||
            (it?.productName as string) ||
            "Ürün";

        // URL tahmini: sources[0].url -> url -> link
        const primaryUrl: string =
            (it?.sources?.[0]?.url as string) ||
            (it?.url as string) ||
            (it?.link as string) ||
            "";

        // Fiyat tahmini: number → direkt; string → TRY parse; sources[0].price → number ise al
        const fromNum =
            typeof it?.price === "number"
                ? (it.price as number)
                : typeof it?.price?.min === "number"
                    ? (it.price.min as number)
                    : typeof it?.sources?.[0]?.price === "number"
                        ? (it.sources[0].price as number)
                        : null;

        const fromStr =
            parsePriceTRY(it?.price) ??
            parsePriceTRY(it?.priceText) ??
            null;

        const priceNum = fromNum ?? fromStr ?? null;

        // sources dizisini toparla
        const sources: { url: string; price?: number | null }[] = [];
        if (Array.isArray(it?.sources)) {
            for (const s of it.sources) {
                if (!s?.url) continue;
                sources.push({
                    url: String(s.url),
                    price: typeof s.price === "number" ? s.price : null,
                });
            }
        }
        if (!sources.length && primaryUrl) {
            sources.push({ url: primaryUrl, price: priceNum });
        }

        const specs =
            (typeof it?.specs === "object" && it?.specs) ? it.specs : {};

        out.push({
            name,
            sources,
            price: { min: priceNum, max: priceNum, currency: "TRY" },
            specs,
        });
    }

    return out;
}
