// src/app/api/search/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { SPEC_SCHEMAS, type Category } from "@/lib/specs";
import { mergeProducts, parsePriceTRY, type Product } from "@/lib/enrich";

/* ===================== ENV / CONST ===================== */
const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT!;
const REGION = process.env.GOOGLE_CLOUD_REGION || "us-central1";

const ALLOWED: string[] = [
    "vatanbilgisayar.com",
    "trendyol.com",
    "hepsiburada.com",
    "n11.com",
    "teknosa.com",
    "mediamarkt.com.tr",
    "incehesap.com",
    "itopya.com",
    "gamegaraj.com",
    "inventus.com.tr",
];

/* ===================== TYPES ===================== */
type SerperItem = {
    title: string;
    link: string;
    price?: string | undefined;
    source?: string | undefined;
};

type Want = {
    dpi?: number;
    weight_g?: number;
    connection?: "kablosuz" | "kablolu";
    budgetMin?: number;
    budgetMax?: number;
};

/* ===================== ROUTE ===================== */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const category = (searchParams.get("category") as Category) || "mouse";
    // strict=1 → sadece TR siteleri; yoksa TR boşsa genel sonuçlara düş
    const strict = searchParams.get("strict") === "1";

    if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
    if (!SERPER_API_KEY) {
        return NextResponse.json({ error: "SERPER_API_KEY missing" }, { status: 500 });
    }

    try {
        // 1) Serper → önce shopping (başarısızsa throw etmeden web'e geç)
        const base: SerperItem[] = await fetchSerper(q);

        // 1.5) TR filtresi (opsiyonel)
        let trOnly: SerperItem[] = base.filter((x: SerperItem) =>
            ALLOWED.some((d: string) => x.link?.includes(d))
        );
        if (!strict && trOnly.length === 0) {
            trOnly = base; // TR bulunmadıysa genel sonuçları kullan
        }

        // 2) Mükerrer birleştir + TL fiyat (varsa)
        let products: Product[] = mergeProducts(trOnly);

        // 3) Eksik fiyatı sayfa içinden tamamla (JSON-LD / regex)
        products = await Promise.all(products.map(fillPriceFromPage));

        // 4) Özellik çıkarımı (kategori şemasına göre; eksik alanlar için hafif LLM)
        products = await Promise.all(products.map((p) => enrichSpecs(p, category)));

        // 5) Kullanıcı filtresini q'dan sez (DPI, ağırlık, bağlantı, bütçe)
        const want: Want = sniffFiltersFromQuery(q);

        // 6) Skorla ve 3 banda ayır + her durumda top10
        const bands = buildBands(products, want);

        // 7) Çıktı
        return NextResponse.json({
            query: q,
            category,
            checkedAt: new Date().toISOString(),
            products,
            bands,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: "search-failed", message: msg }, { status: 500 });
    }
}

/* ===================== SERPER ===================== */
async function fetchSerper(q: string): Promise<SerperItem[]> {
    // 1) shopping (başarısız olursa web'e geç)
    try {
        const s1 = await fetch("https://google.serper.dev/shopping", {
            method: "POST",
            headers: { "X-API-KEY": SERPER_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 20 }),
            next: { revalidate: 60 },
        });
        if (s1.ok) {
            const d1 = await s1.json();
            if (Array.isArray(d1?.shopping_results) && d1.shopping_results.length) {
                return d1.shopping_results as SerperItem[];
            }
        }
    } catch {
        // shopping başarısızsa sessizce web'e geç
    }

    // 2) web fallback
    const s2 = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "tr", hl: "tr", num: 20 }),
        next: { revalidate: 60 },
    });
    if (!s2.ok) throw new Error(`serper web ${s2.status}`);
    const d2 = await s2.json();
    const organic = Array.isArray(d2?.organic) ? d2.organic : [];
    return organic.map((o: any) => ({ title: o.title, link: o.link, price: undefined }));
}

/* ===================== FİYATI SAYFADAN DOLDUR ===================== */
async function fillPriceFromPage(p: Product): Promise<Product> {
    if (p.price?.min != null) return p;
    try {
        const url = p.sources[0]?.url;
        if (!url) return p;
        const res = await fetch(url, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        if (!res.ok) return p;
        const html = await res.text();

        // JSON-LD offers.price
        const m = html.match(
            /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
        );
        let priceNum: number | null = null;
        if (m) {
            for (const block of m) {
                try {
                    const j = JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/gi, ""));
                    const graph = Array.isArray(j?.["@graph"]) ? j["@graph"] : [j];
                    for (const node of graph) {
                        const offer =
                            (node as any)?.offers ||
                            (node as any)?.aggregateOffer ||
                            (node as any)?.aggregateOffers;
                        const val = offer?.price || offer?.lowPrice || offer?.highPrice;
                        const n = parsePriceTRY(String(val));
                        if (n) {
                            priceNum = n;
                            break;
                        }
                    }
                    if (priceNum) break;
                } catch {
                    /* ignore */
                }
            }
        }
        // regex fallback
        if (!priceNum) priceNum = parsePriceTRY(html);

        if (priceNum) {
            p.sources.unshift({ url, price: priceNum });
            p.price = { min: priceNum, max: priceNum, currency: "TRY" };
        }
    } catch {
        /* ignore */
    }
    return p;
}

/* ===================== ÖZELLİK ZENGİNLEŞTİR ===================== */
async function enrichSpecs(p: Product, category: Category): Promise<Product> {
    const defs = SPEC_SCHEMAS[category];
    const pageUrl = p.sources[0]?.url;

    let pageText = "";
    if (pageUrl) {
        try {
            const r = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
            const html = await r.text();
            pageText = html.replace(/\s+/g, " ");
        } catch {
            /* ignore */
        }
    }

    // Regex/başlıktan çıkarım
    for (const d of defs) {
        if (p.specs[d.key] != null) continue;
        let val: any = null;

        // title → hızlı eşleşme
        for (const rx of d.patterns) {
            const mt = p.name.match(rx);
            if (mt) {
                val = mt[1] || mt[0];
                break;
            }
        }
        // sayfa metni → detay
        if (val == null && pageText) {
            for (const rx of d.patterns) {
                const mt = pageText.match(rx);
                if (mt) {
                    val = mt[1] || mt[0];
                    break;
                }
            }
        }
        if (val != null) p.specs[d.key] = d.post ? d.post(val) : val;
    }

    // Eksik kritik alanlar için hafif LLM (yalnızca kısa JSON)
    const needLLM = defs.some((d) => p.specs[d.key] == null);
    if (needLLM && GCP_PROJECT) {
        try {
            const ai = new VertexAI({ project: GCP_PROJECT, location: REGION });
            const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `
Ürün adı: "${p.name}"
Sayfa metni: "${pageText.slice(0, 9000)}"

Kategori: ${category}
Gereken alanlar: ${defs.map((d) => d.key).join(", ")}

Sadece şu JSON'u döndür: {"dpi":number?,"weight_g":number?,"connection":string? ...}
Bilinmiyorsa null bırak.
`.trim();

            const r = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 400,
                    temperature: 0.2,
                    // @ts-ignore
                    responseMimeType: "application/json",
                },
            });

            const txt =
                (r as any)?.response?.text?.() ||
                r?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
                "";
            const j = JSON.parse(txt || "{}");
            for (const k of Object.keys(j || {})) {
                if (j[k] != null && p.specs[k] == null) p.specs[k] = j[k];
            }
        } catch {
            /* ignore */
        }
    }

    return p;
}

/* ===================== FİLTRE SEZGİSİ ===================== */
function sniffFiltersFromQuery(q: string): Want {
    const dpi = /(\d{4,6})\s*dpi/i.exec(q)?.[1];
    const weight = /(\d{2,3})\s*g/i.exec(q)?.[1];
    const wireless = /kablosuz|wireless/i.test(q)
        ? "kablosuz"
        : /kablolu|wired/i.test(q)
            ? "kablolu"
            : undefined;
    const budget = /(\d+)\s*[-–]\s*(\d+)\s*tl/i.exec(q);
    return {
        dpi: dpi ? Number(dpi) : undefined,
        weight_g: weight ? Number(weight) : undefined,
        connection: wireless,
        budgetMin: budget ? Number(budget[1]) : undefined,
        budgetMax: budget ? Number(budget[2]) : undefined,
    };
}

/* ===================== SKOR / BANTLAR ===================== */
function score(p: Product, want: Want): number {
    let s = 0;

    // DPI (varsa) – hedefin üzeri bonus, altı orantılı
    if (want.dpi && typeof p.specs?.dpi === "number") {
        const ratio = p.specs.dpi / want.dpi;
        s += Math.min(1.2, ratio) * 2; // max ~2.4
    }

    // Ağırlık (varsa) – daha hafif daha iyi
    if (want.weight_g && typeof p.specs?.weight_g === "number") {
        s += want.weight_g / p.specs.weight_g;
    }

    // Bağlantı tercihi (varsa)
    if (want.connection && p.specs?.connection) {
        s += want.connection === p.specs.connection ? 1.2 : 0;
    }

    // Bütçe (varsa) – aralığa denk gelirse küçük bonus
    const minPrice = p.price?.min;
    if (
        want.budgetMin != null &&
        want.budgetMax != null &&
        typeof minPrice === "number"
    ) {
        if (minPrice >= want.budgetMin && minPrice <= want.budgetMax) {
            s += 1.0;
        } else {
            const center = (want.budgetMin + want.budgetMax) / 2;
            const dist = Math.abs(minPrice - center) / center;
            s -= Math.min(0.8, dist); // en fazla -0.8
        }
    }

    return s;
}

function buildBands(products: Product[], want: Want) {
    const withPrice = products.filter((p) => typeof p.price?.min === "number");
    const top10 = products
        .map((p) => ({ p, s: score(p, want) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 10)
        .map((x) => x.p);

    let same: Product[] = [];
    let cheaper: Product[] = [];
    let higher: Product[] = [];

    if (withPrice.length >= 2) {
        const prices = withPrice.map((p) => p.price!.min!);
        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];

        same = withPrice
            .filter((p) => Math.abs((p.price!.min! - median) / median) <= 0.1)
            .sort((a, b) => score(b, want) - score(a, want))
            .slice(0, 6);

        cheaper = withPrice
            .filter((p) => (p.price!.min! - median) / median <= -0.15)
            .sort((a, b) => score(b, want) - score(a, want))
            .slice(0, 6);

        higher = withPrice
            .filter((p) => (p.price!.min! - median) / median >= 0.15)
            .sort((a, b) => score(b, want) - score(a, want))
            .slice(0, 6);
    }

    const reference = top10[0]
        ? { name: top10[0].name, price: top10[0].price, specs: top10[0].specs }
        : undefined;

    return {
        top10, // ✅ her durumda en iyi 10 ürün
        same_price_better: same,
        cheaper_similar: cheaper,
        slightly_higher_much_better: higher,
        reference,
    };
}
