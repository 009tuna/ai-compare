// src/lib/priceExtractors.ts

/** "1.234,56", "3.482₺", "12.999 TL" → 12999 (TRY, yuvarlanmış) */
export function normalizePriceTRY(raw: string): number | null {
    if (!raw) return null;
    let s = raw
        .replace(/\u00A0/g, " ")     // NBSP → space
        .replace(/[₺]|TL|TRY/gi, " ") // para birimi
        .replace(/[^\d\.,]/g, " ")   // sayı dışını temizle
        .replace(/\s+/g, " ")        // fazla boşlukları sil
        .trim();

    // "1.234,56" → "1234.56"
    s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
}

/* ---------- Genel şablonlar ---------- */
export function extractPriceFromJsonLdTRY(html: string): number | null {
    try {
        const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (!blocks) return null;
        for (const block of blocks) {
            const jsonStr = block.replace(/^<script[^>]*>|<\/script>$/gi, "");
            try {
                const j = JSON.parse(jsonStr);
                const graph = Array.isArray(j?.["@graph"]) ? j["@graph"] : [j];
                for (const node of graph) {
                    const type = (node as any)["@type"] || (node as any)?.["@type"]?.[0];
                    if (String(type || "").toLowerCase().includes("product")) {
                        const offer =
                            (node as any)?.offers ||
                            (node as any)?.aggregateOffer ||
                            (node as any)?.aggregateOffers;
                        const val = offer?.price || offer?.lowPrice || offer?.highPrice;
                        if (val != null) {
                            const n = normalizePriceTRY(String(val));
                            if (n != null) return n;
                        }
                    }
                }
            } catch { /* ignore malformed json */ }
        }
    } catch { }
    return null;
}

export function extractPriceFromMeta(html: string): number | null {
    const m =
        /<meta[^>]+itemprop=["']price["'][^>]+content=["']([\d\.,]+)["'][^>]*>/i.exec(html) ||
        /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d\.,]+)["'][^>]*>/i.exec(html) ||
        /data-price=["']([\d\.,]+)["']/i.exec(html);
    return m?.[1] ? normalizePriceTRY(m[1]) : null;
}

/* ---------- Domain-özel şablonlar ---------- */

function fromHepsiburada(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    let n = extractPriceFromMeta(html);
    if (n != null) return n;
    let m = /"priceValue"\s*:\s*"([\d\.,]+)"/i.exec(html);
    if (m?.[1]) return normalizePriceTRY(m[1]);
    m = /"price"\s*:\s*"?(?<val>[\d\.,]+)"?/i.exec(html);
    if (m?.groups?.val) return normalizePriceTRY(m.groups.val);
    return null;
}

function fromTrendyol(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    let m = /"salePrice"\s*:\s*"?(?<val>[\d\.,]+)"?/i.exec(html);
    if (m?.groups?.val) return normalizePriceTRY(m.groups.val);
    m = /"sellPrice"\s*:\s*"?(?<val>[\d\.,]+)"?/i.exec(html);
    if (m?.groups?.val) return normalizePriceTRY(m.groups.val);
    return extractPriceFromMeta(html) ?? extractPriceFromJsonLdTRY(html);
}

function fromVatan(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    let n = extractPriceFromJsonLdTRY(html);
    if (n != null) return n;
    const m = /class=["'][^"']*price[^"']*["'][^>]*>\s*([\d\.\,]+)\s*(?:TL|₺)\s*</i.exec(html);
    if (m?.[1]) return normalizePriceTRY(m[1]);
    return extractPriceFromMeta(html);
}

function fromTeknosa(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    const n = extractPriceFromMeta(html) ?? extractPriceFromJsonLdTRY(html);
    if (n != null) return n;
    const m = /class=["'][^"']*price[^"']*["'][^>]*>\s*([\d\.\,]+)\s*(?:TL|₺)\s*</i.exec(html);
    return m?.[1] ? normalizePriceTRY(m[1]) : null;
}

function fromMediaMarkt(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    return extractPriceFromMeta(html) ?? extractPriceFromJsonLdTRY(html);
}

function fromN11(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    return extractPriceFromMeta(html) ?? extractPriceFromJsonLdTRY(html);
}

function fromInceHesap(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    const n = extractPriceFromMeta(html) ?? extractPriceFromJsonLdTRY(html);
    if (n != null) return n;
    const m = /class=["'][^"']*price[^"']*["'][^>]*>\s*([\d\.\,]+)\s*(?:TL|₺)\s*</i.exec(html);
    return m?.[1] ? normalizePriceTRY(m[1]) : null;
}

function fromAmazon(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    // <span class="a-offscreen">1.999,00 TL</span>
    let m = /<span[^>]*class=["']a-offscreen["'][^>]*>\s*([\d\.\,]+)\s*(?:TL|₺)\s*<\/span>/i.exec(html);
    if (m?.[1]) return normalizePriceTRY(m[1]);

    // priceblock_ourprice / dealprice
    m = /id=["']priceblock_(?:ourprice|dealprice)["'][^>]*>\s*([\d\.\,]+)\s*(?:TL|₺)?\s*</i.exec(html);
    if (m?.[1]) return normalizePriceTRY(m[1]);

    // whole + fraction
    const mWhole = /class=["']a-price-whole["'][^>]*>\s*([\d\.]+)\s*</i.exec(html);
    const mFrac = /class=["']a-price-fraction["'][^>]*>\s*(\d{2})\s*</i.exec(html);
    if (mWhole) {
        const s = `${mWhole[1].replace(/\./g, "")}${mFrac ? "." + mFrac[1] : ""}`;
        const n = normalizePriceTRY(s);
        if (n != null) return n;
    }
    return null;

}

function fromGeneric(html: string): number | null {
    const e = extractPriceFromEmbeddedJson(html);
    if (e != null) return e;
    const m = /([\d\.\,]+)\s*(?:TL|₺)/i.exec(html);
    if (m?.[1]) return normalizePriceTRY(m[1]);
    return extractPriceFromMeta(html) ?? extractPriceFromJsonLdTRY(html);
}


/** URL’e göre en uygun çıkarıcıyı seç ve fiyatı TRY olarak döndür. */
export function extractPriceTRY(html: string, url: string): number | null {
    const host = (() => {
        try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
    })();

    if (host.includes("amazon.com.tr")) return fromAmazon(html) ?? fromGeneric(html);
    if (host.includes("hepsiburada.com")) return fromHepsiburada(html) ?? fromGeneric(html);
    if (host.includes("trendyol.com")) return fromTrendyol(html) ?? fromGeneric(html);
    if (host.includes("vatanbilgisayar.com")) return fromVatan(html) ?? fromGeneric(html);
    if (host.includes("n11.com")) return fromN11(html) ?? fromGeneric(html);
    if (host.includes("teknosa.com")) return fromTeknosa(html) ?? fromGeneric(html);
    if (host.includes("mediamarkt.com.tr")) return fromMediaMarkt(html) ?? fromGeneric(html);
    if (host.includes("incehesap.com")) return fromInceHesap(html) ?? fromGeneric(html);

    // diğer domainler için genel mantık
    return fromGeneric(html);
}
function findPriceInObject(obj: any): number | null {
    const PRICE_KEYS = [
        "price", "salePrice", "sellPrice", "finalPrice", "discountedPrice",
        "currentPrice", "bestPrice", "listPrice", "lowPrice", "highPrice", "amount", "value"
    ];
    try {
        const stack = [obj];
        while (stack.length) {
            const cur = stack.pop();
            if (!cur || typeof cur !== "object") continue;

            for (const [k, v] of Object.entries(cur)) {
                const lk = k.toLowerCase();
                const isPriceKey = PRICE_KEYS.some(pk => lk.includes(pk.toLowerCase()));
                if (isPriceKey) {
                    if (typeof v === "number" && Number.isFinite(v)) {
                        if (v > 10 && v < 1000000) return Math.round(v); // TRY güvenlik bandı
                    }
                    if (typeof v === "string") {
                        const n = normalizePriceTRY(v);
                        if (n != null) return n;
                    }
                }
                if (v && typeof v === "object") stack.push(v);
            }
        }
    } catch { }
    return null;
}

// --- YENİ: __NEXT_DATA__ ve application/json scriptlerinden fiyat çek ---
function extractPriceFromEmbeddedJson(html: string): number | null {
    // __NEXT_DATA__
    const next = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (next?.[1]) {
        try {
            const j = JSON.parse(next[1]);
            const n = findPriceInObject(j);
            if (n != null) return n;
        } catch { }
    }
    // diğer application/json script blokları
    const scripts = html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const sc of scripts) {
        const jsonStr = sc.replace(/^<script[^>]*>|<\/script>$/gi, "");
        try {
            const j = JSON.parse(jsonStr);
            const n = findPriceInObject(j);
            if (n != null) return n;
        } catch { }
    }
    return null;
}