// src/lib/muadil.ts
import type { Product } from "@/lib/enrich";

type V = { weight_g?: number; sensor?: number; wireless?: boolean; dpi?: number; };

function toVector(p: Product): V {
    const s = (p as any).specs || {};
    const conn = String(s.connection || "").toLowerCase();
    return {
        weight_g: typeof s.weight_g === "number" ? s.weight_g : undefined,
        sensor: sensorTier(String(s.sensor || "").toLowerCase()),
        wireless: conn === "kablosuz",
        dpi: typeof s.dpi === "number" ? s.dpi : undefined,
    };
}
function sensorTier(name: string) {
    // çok kaba örnek; istersen gerçek sensör haritası koy
    if (/3950|3959|hero 32k|focus pro|3395|3950/.test(name)) return 3;
    if (/hero|3389|3360|3335/.test(name)) return 2;
    return 1;
}

export function similarity(a: Product, b: Product) {
    const va = toVector(a), vb = toVector(b);
    let s = 0, w = 0;
    if (va.weight_g && vb.weight_g) { s += 0.4 * (1 - Math.min(1, Math.abs(va.weight_g - vb.weight_g) / 20)); w += 0.4; }
    if (va.sensor && vb.sensor) { s += 0.3 * (va.sensor === vb.sensor ? 1 : Math.abs(va.sensor - vb.sensor) == 1 ? 0.6 : 0.3); w += 0.3; }
    if (typeof va.dpi === "number" && typeof vb.dpi === "number") { s += 0.1 * Math.min(1, vb.dpi / va.dpi); w += 0.1; }
    if (typeof va.wireless === "boolean" && typeof vb.wireless === "boolean") { s += 0.2 * (va.wireless === vb.wireless ? 1 : 0); w += 0.2; }
    return w ? s / w : 0;
}

export function bucketAlternatives(target: Product, all: Product[]) {
    const tPrice = ((target as any).price?.min as number) | 0;
    const same: Product[] = [];
    const cheaper: Product[] = [];
    const higher: Product[] = [];

    const scored = all
        .filter(x => x !== target && typeof (x as any).price?.min === "number")
        .map(p => ({ p, sim: similarity(target, p), price: (p as any).price.min as number }))
        .sort((a, b) => b.sim - a.sim);

    for (const x of scored) {
        const diff = (x.price - tPrice) / (tPrice || 1);
        if (Math.abs(diff) <= 0.10 && x.sim >= 0.7) same.push(x.p);
        else if (diff >= 0.10 && diff <= 0.30 && x.sim >= 0.75) higher.push(x.p);
        else if (diff <= -0.10 && x.sim >= 0.6) cheaper.push(x.p);
    }

    return {
        same_price_better: same.slice(0, 6),
        slightly_higher_much_better: higher.slice(0, 6),
        cheaper_similar: cheaper.slice(0, 6),
    };
}
