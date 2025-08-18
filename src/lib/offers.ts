// src/lib/offers.ts
import { parsePriceTRY, isPriceSane } from "@/lib/enrich";
import { extractPriceTRY, extractPriceFromJsonLdTRY, extractPriceFromMeta } from "@/lib/priceExtractors";

export type Offer = { domain: string; url: string; price: number; ts: string };

export const SITE_SEARCH_PRIORITY = [
    "hepsiburada.com", "trendyol.com", "n11.com", "vatanbilgisayar.com",
    "teknosa.com", "incehesap.com", "mediamarkt.com.tr", "amazon.com.tr"
];

const SERPER_API_KEY = process.env.SERPER_API_KEY || "";

async function serperSearch(q: string, num = 8) {
    const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "tr", hl: "tr", num }),
        next: { revalidate: 60 },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.organic || []).map((o: any) => String(o?.link || "")).filter(Boolean);
}

function isLikelyProductPage(url: string) {
    const u = new URL(url); const p = u.pathname.toLowerCase(); const h = u.hostname.toLowerCase(); const q = u.search.toLowerCase();
    if (/(search|arama|ara|kategori|category|listing|liste|urunler)/.test(p)) return false;
    if (/(q=|search=|kategori=|k=|s=|kriter=)/.test(q)) return false;
    if (h.includes("amazon.com.tr")) return /\/dp\//.test(p) || /\/gp\/product\//.test(p);
    if (h.includes("hepsiburada.com")) return /-p-\d+/.test(p);
    if (h.includes("trendyol.com")) return /-p-\d+/.test(p);
    if (h.includes("n11.com")) return /\/urun\//.test(p);
    if (h.includes("teknosa.com")) return /\/urun\//.test(p);
    if (h.includes("mediamarkt.com.tr")) return /\/p\//.test(p);
    if (h.includes("incehesap.com")) return /\/urun\//.test(p);
    if (h.includes("vatanbilgisayar.com")) return /\/urun\//.test(p) || /\/product/.test(p) || /productdetails\.aspx/i.test(p);
    return /\/(p|product|urun)\//.test(p) || /-p-\d+/.test(p) || /\/dp\//.test(p);
}

export async function verifyPrice(url: string): Promise<number | null> {
    try {
        const r = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
            },
            next: { revalidate: 60 },
        });
        if (!r.ok) return null;
        const html = await r.text();
        const n = extractPriceTRY(html, url) ?? extractPriceFromJsonLdTRY(html) ?? extractPriceFromMeta(html) ?? parsePriceTRY(html);
        return (n != null && isPriceSane(n)) ? n : null;
    } catch { return null; }
}

export async function collectOffersForEntity(brand?: string, model?: string): Promise<Offer[]> {
    if (!SERPER_API_KEY || !(brand || "").trim() || !(model || "").trim()) return [];
    const query = `${brand} ${model}`.trim();
    const out: Offer[] = [];
    for (const domain of SITE_SEARCH_PRIORITY) {
        const links = await serperSearch(`${query} site:${domain}`, 8);
        for (const url of links.slice(0, 5)) {
            try {
                if (!isLikelyProductPage(url)) continue;
                const price = await verifyPrice(url);
                if (price == null) continue;
                out.push({ domain, url, price, ts: new Date().toISOString() });
            } catch { }
        }
    }
    // tek domain’den yüzlerce gelirse şişmesin:
    const limited = out.slice(0, 20);
    limited.sort((a, b) => a.price - b.price);
    return limited;
}

export function pickCheapest(offers: Offer[] | undefined) {
    return (offers || []).sort((a, b) => a.price - b.price)[0];
}
