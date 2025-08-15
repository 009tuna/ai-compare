// src/lib/normalize.ts
import type { ProductSearchResult } from "@/types";

// "₺1.599,00", "1.599 TL", "1599 TL" → 1599
export function parseTryPrice(input?: string): number | undefined {
    if (!input) return;
    const s = input
        .replace(/[₺\s]/g, "")
        .replace(/\./g, "")
        .replace(/,(\d{2})$/, ".$1");
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function extractDpi(text: string): number | undefined {
    const m = text.match(/(\d{4,5})\s*DPI/i);
    return m ? Number(m[1]) : undefined;
}

export function extractWeight(text: string): number | undefined {
    const m = text.match(/(\d{2,3})\s*g\b/i);
    return m ? Number(m[1]) : undefined;
}

export function enhance(items: ProductSearchResult[]) {
    return items.map((it) => {
        const priceNum = parseTryPrice(it.price);
        const dpi = extractDpi(it.title);
        const weight = extractWeight(it.title);
        return { ...it, priceNum, dpi, weight };
    });
}

// Basit skor: hafiflik + DPI
export function score(item: ProductSearchResult): number {
    let s = 0;
    if (item.weight) s += 100 - Math.min(item.weight, 100);
    if (item.dpi) s += Math.min(item.dpi, 32000) / 1000;
    return s;
}

// Fiyat bandı kovaları
export function bucketize(
    items: ProductSearchResult[],
    target?: number
): { same: ProductSearchResult[]; cheaper: ProductSearchResult[]; higher: ProductSearchResult[] } {
    if (!target) return { same: items, cheaper: [], higher: [] };

    const same: ProductSearchResult[] = [];
    const cheaper: ProductSearchResult[] = [];
    const higher: ProductSearchResult[] = [];

    for (const it of items) {
        if (!it.priceNum) {
            same.push(it);
            continue;
        }
        const diff = it.priceNum - target;
        if (Math.abs(diff) <= 500) same.push(it); // ±₺500 → aynı band
        else if (diff < -500) cheaper.push(it);
        else higher.push(it);
    }
    return { same, cheaper, higher };
}
