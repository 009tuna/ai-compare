export type Source = { url: string; price?: number | null };
export type Product = {
    name: string;
    sources: Source[];
    price?: { min: number | null; max: number | null; currency: "TRY" };
    specs: Record<string, any>;
};

const TL_RE = /(?:₺|tl)\s*([\d\.]+(?:,\d{2})?)/i;

export function parsePriceTRY(s?: string): number | null {
    if (!s) return null;
    const m = s.match(TL_RE);
    if (!m) return null;
    const norm = m[1].replace(/\./g, "").replace(",", ".");
    const n = Number(norm);
    return Number.isFinite(n) ? Math.round(n) : null;
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
                price: { min: priceNum ?? null, max: priceNum ?? null, currency: "TRY" }
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
    return Array.from(map.values());
}
