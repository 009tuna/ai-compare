export type ExtractLinksResult = {
    links: string[];
    counts: { anchors: number; jsonld: number; rawjson: number };
    botWall: boolean;
};

const PRODUCT_PATTERNS: Record<string, RegExp[]> = {
    "hepsiburada.com": [/-p-\d+/],
    "trendyol.com": [/-p-\d+/],
    "n11.com": [/\/urun\//],
    "teknosa.com": [/\/urun\//],
    "mediamarkt.com.tr": [/\/p\//, /\/product\//],
    "itopya.com": [/\/urun\//],
    "incehesap.com": [/\-fiyati-\d+\/?$/, /\/urun\//],
    "vatanbilgisayar.com": [/\/urun\//, /\/product\//, /productdetails\.aspx/i],
    "inventus.com.tr": [/\/product\//],
    "gamegaraj.com": [/\/urun\//],
    "amazon.com.tr": [/\/dp\//, /\/gp\/product\//],
    "sinerji.gen.tr": [/\/urun\//],
    "teknobiyotik.com": [/\/urun\//],
    "pazarama.com": [/\/urun\//],
};

// com.tr, net.tr gibi TLD'lerde kök alan adı 3 label; diğerleri 2.
function rootDomain(host: string): string {
    host = host.toLowerCase();
    if (/\.(com|net|org)\.tr$/.test(host)) {
        const parts = host.split(".");
        return parts.slice(-3).join(".");
    }
    const parts = host.split(".");
    return parts.slice(-2).join(".");
}

function isAssetUrl(u: string): boolean {
    return /\.(?:jpg|jpeg|png|webp|gif|svg|mp4|webm|css|js|mjs|ico|woff2?)(?:[?#]|$)/i.test(u);
}

function isListingish(u: string): boolean {
    const url = u.toLowerCase();
    // path heuristic
    if (/(search|arama|ara|kategori|category|listing|liste|urunler|products)\b/.test(url)) return true;
    // query heuristic
    if (/[?&](q|k|s|search|kategori|kriter|sort|order|price|min|max|page)=/.test(url)) return true;
    return false;
}

function decodeEntitiesInUrl(s: string): string {
    return s.replace(/&amp;/gi, "&");
}

export function absolutizeUrl(href: string, baseUrl: string): string | null {
    try {
        const fixed = decodeEntitiesInUrl(href);
        const u = new URL(fixed, baseUrl); // //example.com/... ve /path için baseUrl devreye girer
        return u.toString();
    } catch {
        return null;
    }
}

function unique<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

export function isBotWall(html: string): boolean {
    const s = html.toLowerCase();
    return (
        s.includes("captcha") ||
        s.includes("cf-chl-") || // cloudflare challenge
        s.includes("just a moment") ||
        s.includes("checking your browser") ||
        s.includes("access denied") ||
        s.includes("incapsula") ||
        s.includes("akamai") ||
        s.includes("please enable javascript and cookies")
    );
}

function looksLikeProduct(absUrl: string): boolean {
    try {
        const u = new URL(absUrl);
        const host = u.hostname.toLowerCase();
        const p = u.pathname.toLowerCase();

        if (isListingish(absUrl)) return false;
        const base = rootDomain(host);
        const pats = PRODUCT_PATTERNS[base];
        if (pats && pats.some((rx) => rx.test(p))) return true;

        // Genel yedek desenler
        if (/\/(p|product|urun)\//.test(p)) return true;
        if (/-p-\d+/.test(p)) return true;
        if (/\/dp\//.test(p)) return true;
        return false;
    } catch {
        return false;
    }
}

function extractViaAnchors(html: string, baseUrl: string, baseRoot: string): string[] {
    const hrefs = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
        .map((m) => m[1])
        .filter(Boolean) as string[];
    const abs = hrefs
        .map((h) => absolutizeUrl(h, baseUrl))
        .filter((u): u is string => !!u);

    return unique(
        abs.filter((u) => {
            try {
                if (isAssetUrl(u) || isListingish(u)) return false;
                const uu = new URL(u);
                const uh = uu.hostname.toLowerCase();
                const up = uu.pathname.toLowerCase();
                if (rootDomain(uh) !== baseRoot) return false; // aynı site içinde kal
                return looksLikeProduct(u) && up.length > 3;
            } catch {
                return false;
            }
        })
    );
}

// JSON-LD içinde ItemList ve Product düğümlerinden URL çıkar
function extractViaJsonLd(html: string, baseUrl: string, baseRoot: string): string[] {
    const out: string[] = [];
    const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const sc of scripts) {
        const jsonStr = sc.replace(/^<script[^>]*>|<\/script>$/gi, "");
        try {
            const data = JSON.parse(jsonStr);
            const nodes = Array.isArray(data) ? data : [data];
            for (const node of nodes) {
                collectUrlsFromLd(node, out);
            }
        } catch {
            // bazı siteler hatalı JSON yazıyor, görmezden gel
        }
    }
    // kök eşleşmesi ve ürün görünümü filtresi
    return unique(
        out
            .map((url) => absolutizeUrl(url, baseUrl))
            .filter((u): u is string => !!u)
            .filter((u) => {
                try {
                    if (isAssetUrl(u) || isListingish(u)) return false;
                    const uh = new URL(u).hostname.toLowerCase();
                    return rootDomain(uh) === baseRoot && looksLikeProduct(u);
                } catch {
                    return false;
                }
            })
    );
}

function collectUrlsFromLd(node: any, out: string[], depth = 0) {
    if (!node || typeof node !== "object" || depth > 6) return;
    // ItemList
    if (node["@type"] === "ItemList" && Array.isArray(node.itemListElement)) {
        for (const li of node.itemListElement) {
            const url = li?.item?.url || li?.url || li?.item;
            if (typeof url === "string") out.push(url);
        }
    }
    // Product
    if (node["@type"] === "Product") {
        const u = node.url || node.mainEntityOfPage;
        if (typeof u === "string") out.push(u);
        if (node.offers && typeof node.offers === "object") {
            const o = Array.isArray(node.offers) ? node.offers : [node.offers];
            for (const ox of o) {
                const u2 = ox?.url || ox?.itemOffered?.url;
                if (typeof u2 === "string") out.push(u2);
            }
        }
    }
    // @graph
    if (Array.isArray(node["@graph"])) {
        for (const g of node["@graph"]) collectUrlsFromLd(g, out, depth + 1);
    }
    // genel recursive tarama
    for (const k of Object.keys(node)) {
        const v = (node as any)[k];
        if (typeof v === "object") collectUrlsFromLd(v, out, depth + 1);
    }
}

// Inline script JSON’larından URL yakalama (Next.js state vb.)
function extractViaRawJson(html: string, baseUrl: string, baseRoot: string): string[] {
    const out: string[] = [];
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of scripts) {
        const m = /<script[^>]*>([\s\S]*?)<\/script>/i.exec(block);
        if (!m) continue;
        const raw = m[1].trim();

        // Doğrudan JSON ise
        if (/^[{\[]/.test(raw)) {
            try {
                const data = JSON.parse(raw);
                findUrlsInObject(data, out);
                continue;
            } catch {
                // JSON değilse aşağıdaki ham pattern desteğine düşecek
            }
        }

        // JSON değilse (window.__STATE__ = {...}) vb., ham pattern ile yakala
        findUrlsByPattern(raw, out);
    }

    return unique(
        out
            .map((u) => absolutizeUrl(u, baseUrl))
            .filter((u): u is string => !!u)
            .filter((u) => {
                try {
                    if (isAssetUrl(u) || isListingish(u)) return false;
                    const uh = new URL(u).hostname.toLowerCase();
                    return rootDomain(uh) === baseRoot && looksLikeProduct(u);
                } catch {
                    return false;
                }
            })
    );
}

// JSON olmayan script bloklarında (inline JS) quoted halde geçen linkleri yakala
function findUrlsByPattern(raw: string, out: string[]) {
    // Hem absolute (https://...) hem köke göre ( /urun/... ) linkler;
    // ürün sayfası olma ihtimali yüksek pattern’leri daraltılmış biçimde tararız.
    const re = /["']((?:https?:\/\/|\/)[^"' ]*(?:-p-\d+|\/dp\/[^"'?]+|\/urun\/[^"'?]+|\/product\/[^"'?]+)[^"' ]*)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const u = m[1];
        if (u) out.push(u);
    }
}

// Ham HTML/JS içinde quoted URL deseni (double/single quote) – JSON gerektirmez
function extractViaRawPattern(html: string, baseUrl: string, baseRoot: string): string[] {
    const rx = /["'](\/[^"']*(?:-p-\d+|\/dp\/[^"'?]+|\/urun\/[^"'?]+|\/product\/[^"'?]+)[^"']*)["']/gi;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = rx.exec(html)) !== null) {
        const href = m[1];
        const abs = absolutizeUrl(href, baseUrl);
        if (!abs) continue;
        try {
            const uh = new URL(abs).hostname.toLowerCase();
            if (rootDomain(uh) !== baseRoot) continue;
            out.push(abs);
        } catch { }
    }
    return unique(out);
}

function findUrlsInObject(obj: any, out: string[], depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 6) return;
    for (const k of Object.keys(obj)) {
        const v: any = (obj as any)[k];
        if (typeof v === "string") {
            if (/^https?:\/\//i.test(v)) out.push(v);
            if (/^\/.+/.test(v)) out.push(v); // köke göre göreli
        } else if (typeof v === "object") {
            findUrlsInObject(v, out, depth + 1);
        }
    }
}

export function extractProductLinksSmart(html: string, baseUrl: string): ExtractLinksResult {
    const baseHost = new URL(baseUrl).hostname.toLowerCase();
    const baseRoot = rootDomain(baseHost);

    const anchors = extractViaAnchors(html, baseUrl, baseRoot);
    const jsonld = extractViaJsonLd(html, baseUrl, baseRoot);
    const rawjsonParsed = extractViaRawJson(html, baseUrl, baseRoot);
    const rawpattern = extractViaRawPattern(html, baseUrl, baseRoot);

    const combined = unique([...anchors, ...jsonld, ...rawjsonParsed, ...rawpattern])
        .filter((u) => !isAssetUrl(u) && !isListingish(u) && looksLikeProduct(u));

    return {
        links: combined.slice(0, 40),
        counts: { anchors: anchors.length, jsonld: jsonld.length, rawjson: rawjsonParsed.length + rawpattern.length },
        botWall: isBotWall(html),
    };
}

function decodeHtml(s: string) {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
}

export function getTitleFromHtml(html: string): string {
    const t1 = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
    const og =
        /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1] ||
        /<meta[^>]+name=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1];
    const raw = t1 || og || "";
    return decodeHtml(raw).replace(/\s+/g, " ").trim();
}