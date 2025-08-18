// src/lib/entity.ts
import type { Product } from "@/lib/enrich";

export type Entity = {
    key: string;
    brand?: string;
    model?: string;
    specs: Record<string, any>;
    products: Product[];       // aynı varlığa ait linkler
};

export function toSlug(s?: string) {
    return (s || "").toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeModel(m?: string) {
    return (m || "").replace(/\s+/g, " ").trim().toLowerCase()
        .replace(/(gaming|mouse|kablosuz|kablolu|wireless|lightspeed)/g, "")
        .replace(/\s+/g, " ").trim();
}

// Basit name -> brand,model çıkarımı (LLM yok; istersen Vertex fallback ekleyebilirsin)
export function extractBrandModel(name: string): { brand?: string; model?: string } {
    const n = (name || "").replace(/\s+/g, " ").trim();

    // bilinen bazı markaları yakala
    const brands = ["logitech", "razer", "steelseries", "glorious", "zowie", "asus", "msi", "corsair", "finalmouse", "delux", "gamepower", "rampage", "hp", "lenovo"];
    const lower = n.toLowerCase();
    const brand = brands.find(b => lower.includes(b));
    // marka sonrasını model varsay (çok daha iyi yapılabilir)
    let model: string | undefined;
    if (brand) {
        const idx = lower.indexOf(brand);
        model = n.slice(idx + brand.length).replace(/[-–:|]/, " ").replace(/\s+/g, " ").trim();
        // sık düşen çöp ekleri temizle
        model = model?.replace(/\b(mouse|fare|oyuncu|gaming|kablosuz|kablolu)\b/gi, "").trim();
        if (!model) model = undefined;
    }
    return { brand: brand ? brand[0].toUpperCase() + brand.slice(1) : undefined, model };
}

export function resolveEntityKey(p: Product): { key: string; brand?: string; model?: string } {
    const name = String((p as any).name || "");
    const { brand, model } = extractBrandModel(name);
    const key = `${toSlug(brand)}:${normalizeModel(model)}` || toSlug(name);
    return { key, brand, model };
}

export function mergeProductsToEntities(products: Product[]): Entity[] {
    const map = new Map<string, Entity>();
    for (const p of products) {
        const { key, brand, model } = resolveEntityKey(p);
        const prev = map.get(key);
        if (!prev) {
            map.set(key, { key, brand, model, specs: { ...(p as any).specs }, products: [p] });
        } else {
            prev.products.push(p);
            // specs birleştirme: boş olanları doldur
            for (const [k, v] of Object.entries((p as any).specs || {})) {
                if (v != null && prev.specs[k] == null) prev.specs[k] = v;
            }
        }
    }
    return Array.from(map.values());
}
