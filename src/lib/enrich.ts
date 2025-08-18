// src/lib/enrich.ts
export type Source = { url: string; price?: number | null };
export type Product = {
    name: string;
    sources: Source[];
    price?: { min: number | null; max: number | null; currency: "TRY" };
    specs: Record<string, any>;
};

// TL: birden çok eşleşmeyi yakala; makul aralıkta medyanı dön
const TL_RE =
    /(?:₺|\bTL\b)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)/gi;

export function isPriceSane(n: number) {
    // "9 TL", "45 TL" gibi anlamsız değerleri ele
    return n >= 200 && n <= 200000;
}

export function parsePriceTRY(s?: string): number | null {
    if (!s) return null;
    let m: RegExpExecArray | null;
    const nums: number[] = [];
    while ((m = TL_RE.exec(s)) !== null) {
        const raw = m[1];
        const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(n)) nums.push(Math.round(n));
    }
    const candidates = nums.filter(isPriceSane);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a - b);
    return candidates[Math.floor(candidates.length / 2)]; // medyan
}

export function normalizeName(name: string): string {
    return (name || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9ğüşöçı]/g, "");
}

export function mergeProducts(items: { title: string; link: string; price?: string }[]): Product[] {
    const map = new Map<string, Product>();
    for (const it of items) {
        const key = normalizeName(it.title);
        const priceNum = parsePriceTRY(it.price);
        if (!map.has(key)) {
            map.set(key, {
                name: it.title,
                sources: [{ url: it.link, price: priceNum }],
                specs: {},
                price: {
                    min: priceNum ?? null,
                    max: priceNum ?? null,
                    currency: "TRY",
                },
            });
        } else {
            const p = map.get(key)!;
            p.sources.push({ url: it.link, price: priceNum });
            if (priceNum != null) {
                p.price!.min = p.price!.min == null ? priceNum : Math.min(p.price!.min, priceNum);
                p.price!.max = p.price!.max == null ? priceNum : Math.max(p.price!.max, priceNum);
            }
        }
    }

    // ürünün en az bir makul fiyatı yoksa ele
    return Array.from(map.values()).filter((p) => typeof p.price?.min === "number" && isPriceSane(p.price!.min!));
}
