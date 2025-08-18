// src/app/api/search/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { SPEC_SCHEMAS, type Category } from "@/lib/specs";
import { isPriceSane, parsePriceTRY, type Product } from "@/lib/enrich";
import { extractProductLinksSmart, getTitleFromHtml } from "@/lib/siteParsers";
import {
    extractPriceTRY,
    extractPriceFromJsonLdTRY,
    extractPriceFromMeta,
} from "@/lib/priceExtractors";

/* ================== ENV ================== */
const SERPER_API_KEY = process.env.SERPER_API_KEY || "";
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "";
const REGION = process.env.GOOGLE_CLOUD_REGION || "us-central1";

/* ================== CONSTANTS ================== */
const ALLOWED: string[] = [
    "hepsiburada.com",
    "trendyol.com",
    "n11.com",
    "vatanbilgisayar.com",
    "teknosa.com",
    "mediamarkt.com.tr",
    "incehesap.com",
    "itopya.com",
    "inventus.com.tr",
    "gamegaraj.com",
    "amazon.com.tr",
    "sinerji.gen.tr",
    "teknobiyotik.com",
    "pazarama.com",
];

const SITE_SEARCH_PRIORITY: string[] = [
    "hepsiburada.com",
    "trendyol.com",
    "n11.com",
    "vatanbilgisayar.com",
    "teknosa.com",
    "incehesap.com",
    "mediamarkt.com.tr",
    "amazon.com.tr",
];

const ACCESSORY_CATEGORIES = new Set<Category>(["mouse", "klavye", "kulaklik"]);

/* ================== TYPES ================== */
type SerperItem = { title: string; link: string; price?: string };

type Want = {
    dpi?: number;
    weight_g?: number;
    weightMin_g?: number;
    weightMax_g?: number;
    connection?: "kablosuz" | "kablolu" | string;
    budgetMin?: number;
    budgetMax?: number;
};

/* ================== HELPERS ================== */
function isAllowedDomain(url: string) {
    try {
        const u = new URL(url);
        return ALLOWED.some((d) => u.hostname.includes(d));
    } catch {
        return false;
    }
}

function isLikelyProductPage(url: string) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const p = u.pathname.toLowerCase();
        const q = u.search.toLowerCase();

        if (/(search|arama|ara|kategori|category|listing|liste|urunler)/.test(p)) return false;
        if (/(q=|search=|kategori=|k=|s=|kriter=)/.test(q)) return false;

        if (host.includes("amazon.com.tr")) return /\/dp\//.test(p) || /\/gp\/product\//.test(p);
        if (host.includes("hepsiburada.com")) return /-p-\d+/.test(p);
        if (host.includes("trendyol.com")) return /-p-\d+/.test(p);
        if (host.includes("n11.com")) return p.includes("/urun/");
        if (host.includes("teknosa.com")) return p.includes("/urun/");
        if (host.includes("mediamarkt.com.tr")) return /\/p\//.test(p) || p.includes("/product/");
        if (host.includes("itopya.com")) return p.includes("/urun/");
        if (host.includes("incehesap.com")) return p.includes("/urun/") || /-fiyati-[0-9]+/.test(p);
        if (host.includes("vatanbilgisayar.com")) return p.includes("/urun/") || p.includes("/product") || /productdetails\.aspx/i.test(p);
        if (host.includes("inventus.com.tr")) return p.includes("/product/");
        if (host.includes("gamegaraj.com")) return p.includes("/urun/");
        if (host.includes("sinerji.gen.tr")) return p.includes("/urun/");
        if (host.includes("teknobiyotik.com")) return p.includes("/urun/");
        if (host.includes("pazarama.com")) return p.includes("/urun/");

        return /\/(p|product|urun)\//.test(p) || /-p-\d+/.test(p) || /\/dp\//.test(p);
    } catch {
        return false;
    }
}

function simplifySiteQuery(q: string, category: string): string[] {
    const s = q
        .toLowerCase()
        .replace(/(\d+)\s*[-–]\s*(\d+)\s*tl/gi, " ")
        .replace(/\btl\b|₺/gi, " ")
        .replace(/\b\d+\s*g\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    const hasWireless = /kablosuz|wireless/i.test(s);
    const baseTerms = [category, "mouse", "fare"].includes(category) ? ["mouse", "fare"] : [category];
    const variants: string[] = [];

    for (const base of baseTerms) {
        variants.push(hasWireless ? `kablosuz ${base}` : base);
        variants.push(`oyuncu ${base}`);
    }

    return Array.from(new Set(variants.map((x) => x.trim()).filter(Boolean)));
}

function sniffFiltersFromQuery(q: string): Want {
    const s = q.toLowerCase();
    const want: Want = {};

    const idxDpi = s.indexOf("dpi");
    if (idxDpi >= 0) {
        const n = readNumberBeforeIndex(s, idxDpi);
        if (n != null) want.dpi = n;
    }

    const idxG = s.indexOf("g");
    if (idxG > 0) {
        const w = readNumberBeforeIndex(s, idxG);
        if (w != null && w >= 20 && w <= 200) {
            want.weight_g = w;
        }
    }

    const hasAlt =
        s.includes("altı") || s.includes("alti") || s.includes("<=") || s.includes("<") || s.includes("en fazla") || s.includes("altında");
    const hasUstu =
        s.includes("üstü") || s.includes("ustu") || s.includes(">=") || s.includes(">") || s.includes("en az") || s.includes("üzerinde") || s.includes("uzerinde");
    if (want.weight_g != null) {
        if (hasAlt) want.weightMax_g = want.weight_g;
        if (hasUstu) want.weightMin_g = want.weight_g;
    }

    if (s.includes("kablosuz") || s.includes("wireless")) want.connection = "kablosuz";
    else if (s.includes("kablolu") || s.includes("wired")) want.connection = "kablolu";

    const dashIdx = s.indexOf("-");
    const ndashIdx = dashIdx >= 0 ? dashIdx : s.indexOf("–");
    if (ndashIdx > 0) {
        const left = readNumberBeforeIndex(s, ndashIdx);
        const right = readNumberAfterIndex(s, ndashIdx);
        if (left != null && right != null) {
            want.budgetMin = left;
            want.budgetMax = right;
        }
    }

    return want;
}

function score(p: Product, want: Want): number {
    let s = 0;
    if (want.dpi && typeof (p as any).specs?.dpi === "number") s += Math.min(1.2, ((p as any).specs.dpi as number) / want.dpi) * 2;
    if (want.weight_g && typeof (p as any).specs?.weight_g === "number") s += want.weight_g / ((p as any).specs.weight_g as number);
    if (want.connection && (p as any).specs?.connection) s += want.connection === (p as any).specs.connection ? 1.2 : 0;
    if (want.budgetMin != null && want.budgetMax != null && typeof (p as any).price?.min === "number") {
        const n = (p as any).price.min as number;
        if (n >= want.budgetMin && n <= want.budgetMax) s += 1.0;
    }
    return s;
}

function buildBands(products: Product[], want: Want) {
    const withPrice = products.filter((p) => typeof (p as any).price?.min === "number");
    const top10 = withPrice
        .map((p) => ({ p, s: score(p, want) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 10)
        .map((x) => x.p);

    let same: Product[] = [], cheaper: Product[] = [], higher: Product[] = [];
    if (withPrice.length >= 2) {
        const prices = withPrice.map((p) => (p as any).price!.min as number).sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        same = withPrice
            .filter((p) => Math.abs((((p as any).price!.min as number) - median) / median) <= 0.1)
            .sort((a, b) => score(b, want) - score(a, want))
            .slice(0, 6);
        cheaper = withPrice
            .filter((p) => (((p as any).price!.min as number) - median) / median <= -0.15)
            .sort((a, b) => score(b, want) - score(a, want))
            .slice(0, 6);
        higher = withPrice
            .filter((p) => (((p as any).price!.min as number) - median) / median >= 0.15)
            .sort((a, b) => score(b, want) - score(a, want))
            .slice(0, 6);
    }
    const reference = top10[0]
        ? { name: (top10[0] as any).name, price: (top10[0] as any).price, specs: (top10[0] as any).specs }
        : undefined;
    return { top10, same_price_better: same, cheaper_similar: cheaper, slightly_higher_much_better: higher, reference } as const;
}

function itemsToProducts(items: SerperItem[]): Product[] {
    const out: Product[] = [];
    const seen = new Set<string>();
    for (const it of items) {
        try {
            const url = new URL(it.link).toString();
            if (seen.has(url)) continue;
            seen.add(url);
            const p: any = {
                name: it.title || "Ürün",
                sources: [{ url }],
                price: { min: null, max: null, currency: "TRY" },
                specs: {},
            };
            if (it.price) {
                const n = parsePriceTRY(it.price);
                if (n != null && isPriceSane(n)) {
                    p.price = { min: n, max: n, currency: "TRY" };
                    p.sources[0].price = n;
                }
            }
            out.push(p as Product);
        } catch {
            // ignore bad url
        }
    }
    return out;
}

function readNumberBeforeIndex(s: string, idx: number): number | undefined {
    let i = idx - 1;
    let digits = "";
    while (i >= 0 && s[i] >= "0" && s[i] <= "9") {
        digits = s[i] + digits;
        i--;
    }
    return digits ? Number(digits) : undefined;
}

function readNumberAfterIndex(s: string, idx: number): number | undefined {
    let i = idx + 1;
    while (i < s.length && s[i] === " ") i++;
    let digits = "";
    while (i < s.length && s[i] >= "0" && s[i] <= "9") {
        digits += s[i];
        i++;
    }
    return digits ? Number(digits) : undefined;
}

// Aykırı ağırlıkları temizle, bağlantı türünü normalize et
function sanitizeSpecs(p: Product): Product {
    try {
        (p as any).specs = (p as any).specs || {};
        const w = Number((p as any).specs?.weight_g);
        if (!(Number.isFinite(w) && w >= 20 && w <= 200)) {
            if ((p as any).specs && "weight_g" in (p as any).specs) delete (p as any).specs.weight_g;
        }

        const name = String((p as any).name || "").toLowerCase();
        let conn = String((p as any).specs?.connection || "").toLowerCase();

        if (!conn) {
            if (name.includes("kablosuz") || name.includes("wireless") || name.includes("bluetooth") || name.includes("lightspeed") || name.includes("2.4g")) {
                conn = "kablosuz";
            } else if (name.includes("kablolu") || name.includes("wired")) {
                conn = "kablolu";
            }
        }

        if (conn.includes("kablosuz") || conn.includes("wireless") || conn.includes("bluetooth") || conn.includes("lightspeed") || conn.includes("2.4g")) (p as any).specs.connection = "kablosuz";
        else if (conn.includes("kablolu") || conn.includes("wired")) (p as any).specs.connection = "kablolu";
    } catch { }
    return p;
}

// Sorgudan gelen kısıtları sert filtre olarak uygula (bağlantı bilinmiyorsa da ele)
function filterByQuery(products: Product[], want: Want): Product[] {
    return products.filter((p) => {
        const price = (p as any).price?.min as number | undefined;
        if (want.budgetMin != null && want.budgetMax != null) {
            if (!(price != null && price >= want.budgetMin && price <= want.budgetMax)) return false;
        }

        const conn = String((p as any).specs?.connection || "").toLowerCase();
        if (want.connection) {
            if (conn !== want.connection) return false;
        }

        const w = (p as any).specs?.weight_g as number | undefined;
        if (want.weightMax_g != null) {
            if (!(typeof w === "number" && w <= want.weightMax_g + 2)) return false;
        }
        if (want.weightMin_g != null) {
            if (!(typeof w === "number" && w >= want.weightMin_g - 2)) return false;
        }
        return true;
    });
}

/* ================== ROUTE ================== */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const qRaw = (searchParams.get("q") || "").trim();
    const rawCategory = (searchParams.get("category") || "mouse") as Category;
    const debug = searchParams.get("debug") === "1";

    if (!qRaw) return NextResponse.json({ error: "q required" }, { status: 400 });
    if (!SERPER_API_KEY) return NextResponse.json({ error: "SERPER_API_KEY missing" }, { status: 500 });
    if (!ACCESSORY_CATEGORIES.has(rawCategory)) {
        return NextResponse.json({ error: "only accessory categories allowed" }, { status: 400 });
    }

    const category = rawCategory;
    const q = `${qRaw} ${category}`.trim();

    const dbg: any = { q, stage: [], listing: [] as any[], siteWeb: [] as any[], checks: [] as any[] };
    if (debug) {
        (globalThis as any).__searchDbg = dbg.checks;
    } else {
        (globalThis as any).__searchDbg = undefined;
    }

    try {
        /* 1) SERPER SHOPPING */
        const baseShopping = await fetchSerperShopping(q);
        dbg.stage.push({ shoppingCount: baseShopping.length });

        /* 2) TR allowed + ürün sayfası */
        let items: SerperItem[] = baseShopping.filter((x) => isAllowedDomain(x.link) && isLikelyProductPage(x.link));
        dbg.stage.push({ afterProductFilter: items.length });

        /* 3) WEB fallback */
        let baseWeb: SerperItem[] = [];
        if (baseShopping.length === 0) {
            baseWeb = await fetchSerperWeb(q);
            dbg.stage.push({ webCount: baseWeb.length });
        }

        /* 4) Listing sayfalarından ürün linkleri çıkar */
        if (items.length < 3) {
            const listingPool = (baseShopping.length ? baseShopping : baseWeb)
                .filter((x) => isAllowedDomain(x.link))
                .slice(0, 8);

            let listingChecked = 0,
                productLinks = 0,
                productPagesParsed = 0,
                added = 0,
                botWalls = 0;

            for (const it of listingPool) {
                try {
                    listingChecked++;
                    const r = await fetch(it.link, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
                        },
                        cache: "no-store",
                    });
                    const status = r.status;
                    if (!r.ok) {
                        dbg.listing.push({ url: it.link, status });
                        continue;
                    }
                    const html = await r.text();
                    const { links, counts, botWall } = extractProductLinksSmart(html, it.link);
                    if (botWall) botWalls++;
                    const productLinksOnly = Array.from(new Set(
                        links.filter((u) => isAllowedDomain(u) && isLikelyProductPage(u))
                    ));
                    productLinks += productLinksOnly.length;
                    dbg.listing.push({ url: it.link, status, counts, botWall });

                    for (const plink of productLinksOnly.slice(0, 20)) {
                        try {
                            const pr = await fetch(plink, {
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                                    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
                                },
                                cache: "no-store",
                            });
                            if (!pr.ok) continue;
                            const phtml = await pr.text();
                            productPagesParsed++;

                            const title = getTitleFromHtml(phtml) || it.title || "Ürün";
                            let pTry: number | null = null;
                            try {
                                pTry =
                                    extractPriceTRY(phtml, plink) ??
                                    extractPriceFromJsonLdTRY(phtml) ??
                                    extractPriceFromMeta(phtml) ??
                                    parsePriceTRY(phtml);
                            } catch { }

                            const add: SerperItem = {
                                title,
                                link: plink,
                                ...(pTry != null && isPriceSane(pTry) ? { price: `${pTry} TL` } : {}),
                            };
                            items.push(add);
                            added++;
                        } catch {
                            // ignore product page fetch errors
                        }
                    }
                } catch {
                    // ignore listing fetch errors
                }
            }
            dbg.stage.push({ listingChecked, productLinks, productPagesParsed, addedFromListing: added, botWalls });
        }

        /* 5) Site-bazlı basit aramalar (hala azsa) */
        if (items.length < 3) {
            const queries = simplifySiteQuery(qRaw, "mouse");
            const siteWeb = await fetchSerperSiteWeb(queries, SITE_SEARCH_PRIORITY);
            const siteItems = siteWeb.filter((x) => isLikelyProductPage(x.link));
            items.push(...siteItems);
            dbg.siteWeb = siteWeb;
            dbg.stage.push({ siteWebQueries: queries, siteWebAdded: siteItems.length });
        }

        if (!items.length) {
            const payload: any = {
                query: qRaw,
                category,
                products: [],
                bands: { top10: [] },
                message: "Türkiye sitelerinde uygun ürün bulunamadı.",
            };
            if (debug) payload.debug = dbg;
            return NextResponse.json(payload, { status: 200 });
        }

        /* 6) Items → Product (URL garantili) */
        let products: Product[] = itemsToProducts(items);

        products = products
            .map((p: any) => {
                const url = p?.sources?.[0]?.url || p?.url || p?.link;
                if (!url) return null;
                if (!p.sources || !p.sources.length) p.sources = [{ url }];
                else if (!p.sources[0].url) p.sources[0].url = url;
                return p;
            })
            .filter(Boolean) as Product[];

        if (!products.length) {
            const payload: any = {
                query: qRaw,
                category,
                products: [],
                bands: { top10: [] },
                message: "URL bulunamadı.",
            };
            if (debug) payload.debug = dbg;
            return NextResponse.json(payload, { status: 200 });
        }

        /* 7) Fiyat doğrulama (domain-özel extractor) */
        const checked: Product[] = [];
        for (const p of products) {
            const verified = await verifyAndFillPriceStrict(p);
            if (typeof (verified as any).price?.min === "number" && isPriceSane((verified as any).price.min as number)) {
                checked.push(verified);
            }
        }
        dbg.stage.push({ afterVerify: checked.length });

        if (!checked.length) {
            const payload: any = {
                query: qRaw,
                category,
                products: [],
                bands: { top10: [] },
                message: "Fiyatı doğrulanmış ürün bulunamadı.",
            };
            if (debug) payload.debug = dbg;
            return NextResponse.json(payload, { status: 200 });
        }

        /* 8) Özellik zenginleştirme */
        const enriched = await Promise.all(checked.map((p) => enrichSpecs(p, category)));
        const enrichedClean = enriched.map(sanitizeSpecs);

        /* 9) İstekten kısıtları çıkar ve sert filtre uygula */
        const want = sniffFiltersFromQuery(qRaw);
        const filtered = filterByQuery(enrichedClean, want);
        dbg.stage.push({ afterFilter: filtered.length, beforeFilter: enrichedClean.length });

        /* 10) Sonuçlar + Bantlar */
        const bands = buildBands(filtered, want);
        const fallbackBands = !filtered.length ? buildBands(enrichedClean, want) : undefined;

        const payload: any = {
            query: qRaw,
            category,
            checkedAt: new Date().toISOString(),
            products: filtered, // <-- artık sadece filtreye uyanlar
            bands,
            ...(filtered.length
                ? {}
                : { message: "Filtrelere tam uyan ürün bulunamadı. Yakın alternatifler için 'fallbackBands' döndürüldü.", fallbackBands }),
        };
        if (debug) payload.debug = dbg;

        return NextResponse.json(payload, { status: 200 });
    } catch (e: any) {
        return NextResponse.json(
            { error: "search-failed", message: e?.message || String(e) },
            { status: 500 }
        );
    }
}

/* ================== SERPER ================== */
async function fetchSerperShopping(q: string): Promise<SerperItem[]> {
    try {
        const r = await fetch("https://google.serper.dev/shopping", {
            method: "POST",
            headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 30 }),
            next: { revalidate: 60 },
        });
        if (!r.ok) return [];
        const d = await r.json();
        const arr = Array.isArray(d?.shopping_results) ? d.shopping_results : [];
        return arr.map((o: any) => ({ title: o?.title, link: o?.link, price: o?.price }));
    } catch {
        return [];
    }
}

async function fetchSerperWeb(q: string): Promise<SerperItem[]> {
    try {
        const r = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 30 }),
            next: { revalidate: 60 },
        });
        if (!r.ok) return [];
        const d = await r.json();
        const org = Array.isArray(d?.organic) ? d.organic : [];
        return org.map((o: any) => ({ title: o?.title, link: o?.link }));
    } catch {
        return [];
    }
}

async function fetchSerperSiteWeb(queries: string[], domains: string[]): Promise<SerperItem[]> {
    const out: SerperItem[] = [];
    for (const domain of domains) {
        for (const q of queries) {
            const full = `${q} site:${domain}`;
            try {
                const r = await fetch("https://google.serper.dev/search", {
                    method: "POST",
                    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
                    body: JSON.stringify({ q: full, gl: "tr", hl: "tr", num: 10 }),
                    next: { revalidate: 60 },
                });
                if (!r.ok) continue;
                const d = await r.json();
                const org = Array.isArray(d?.organic) ? d.organic : [];
                for (const o of org.slice(0, 5)) {
                    const link = o?.link as string;
                    if (link && isAllowedDomain(link)) out.push({ title: o?.title, link });
                }
            } catch {
                // ignore
            }
        }
    }
    return out;
}

/* ================== VERIFY PRICE ================== */
async function verifyAndFillPriceStrict(p: Product): Promise<Product> {
    const url = (p as any)?.sources?.[0]?.url as string | undefined;
    if (!url) {
        try {
            (globalThis as any).__searchDbg?.push?.({ url: null, status: null, price: null, reason: "no-url", name: (p as any).name });
        } catch { }
        return p;
    }

    let stat: number | undefined;
    let picked: number | null = null;

    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            cache: "no-store",
        });
        stat = res.status;
        if (!res.ok) return p;

        const html = await res.text();

        let price =
            extractPriceTRY(html, url) ??
            extractPriceFromJsonLdTRY(html) ??
            extractPriceFromMeta(html) ??
            parsePriceTRY(html);

        if (price != null && isPriceSane(price)) {
            (p as any).sources = [{ url, price }];
            (p as any).price = { min: price, max: price, currency: "TRY" };
            picked = price;
        } else {
            (p as any).price = { min: null, max: null, currency: "TRY" };
        }
    } catch {
        // ignore network errors
    }

    try {
        (globalThis as any).__searchDbg?.push?.({ url, status: stat ?? null, price: picked ?? null });
    } catch { }

    return p;
}

/* ================== ENRICH SPECS ================== */
async function enrichSpecs(p: Product, category: Category): Promise<Product> {
    const defs = SPEC_SCHEMAS[category];
    const pageUrl = (p as any)?.sources?.[0]?.url as string | undefined;

    let pageText = "";
    if (pageUrl) {
        try {
            const r = await fetch(pageUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
                },
                cache: "no-store",
            });
            const html = await r.text();
            pageText = html.replace(/\s+/g, " ");
        } catch { }
    }

    // Basit regex temelli doldurma (isim ve sayfadan)
    for (const d of defs) {
        if ((p as any).specs?.[d.key] != null) continue;
        let val: any = null;

        for (const rx of d.patterns) {
            const mt = ((p as any).name as string).match(rx);
            if (mt) {
                val = mt[1] || mt[0];
                break;
            }
        }
        if (val == null && pageText) {
            for (const rx of d.patterns) {
                const mt = pageText.match(rx);
                if (mt) {
                    val = mt[1] || mt[0];
                    break;
                }
            }
        }
        if (val != null) (p as any).specs[d.key] = d.post ? d.post(String(val)) : val;
    }

    // Gerekirse Vertex ile kalan boşlukları doldur
    if (GCP_PROJECT) {
        try {
            const need = defs.some((d) => (p as any).specs?.[d.key] == null);
            if (!need) return p;
            const ai = new VertexAI({ project: GCP_PROJECT, location: REGION });
            const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `
Ürün: "${(p as any).name}"
Kategori: ${category}
Metin: "${pageText.slice(0, 9000)}"
Gereken alanlar: ${defs.map((d) => d.key).join(", ")}
Sadece şu JSON'u döndür: {"dpi":number?,"weight_g":number?,"connection":string?}
Bilinmiyorsa null bırak.`.trim();

            const r = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 400, temperature: 0.2, responseMimeType: "application/json" as any },
            });

            const txt = (r as any)?.response?.text?.() || r?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (txt) {
                try {
                    const j = JSON.parse(txt);
                    for (const k of Object.keys(j || {})) {
                        if (j[k] != null && (p as any).specs[k] == null) (p as any).specs[k] = j[k];
                    }
                } catch {
                    // ignore json parse
                }
            }
        } catch {
            // ignore vertex errors
        }
    }

    return p;
}
