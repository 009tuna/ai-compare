// /lib/searchAndAnalyze.ts

import { VertexAI } from "@google-cloud/vertexai";
import fetch from "node-fetch";

const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT!;
const vertexAI = new VertexAI({ project: PROJECT_ID, location: "us-central1" });

export async function searchAndAnalyze(query: string) {
    // 1. SERPER API → TR-only arama
    const serperRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            q: query,
            gl: "tr", // Türkiye
            hl: "tr",
            num: 20
        })
    });

    if (!serperRes.ok) throw new Error(`Serper API hatası: ${await serperRes.text()}`);
    const data = await serperRes.json();

    // 2. Gelen ürünleri temizle & birleştir
    const mergedProducts = mergeSameProducts(data.organic || []);

    // 3. Vertex AI ile formatlama
    const model = vertexAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        generationConfig: {
            maxOutputTokens: 1200, // uzun listeler için yeterli
            temperature: 0.3
        }
    });

    const prompt = `
Elindeki ürün listesini şu formatta JSON olarak döndür:
[
  {
    "markaModel": "...",
    "kisaAciklama": "...",
    "fiyat": "en düşük - en yüksek TL",
    "link": "en güvenilir site linki"
  }
]
Fiyatı TL olarak yaz, TL olmayanları gösterme. Aynı ürünler birleştirildi.
Ürün listesi:
${JSON.stringify(mergedProducts)}
`;

    const result = await model.generateContent(prompt);
    const output = result.response.candidates?.[0]?.content.parts?.[0]?.text;

    try {
        return JSON.parse(output || "[]");
    } catch {
        return output || [];
    }
}

// 🔹 Aynı ürünleri birleştirme
function mergeSameProducts(items: any[]) {
    const map = new Map();

    items.forEach(item => {
        const key = normalizeName(item.title);
        const price = parsePrice(item.price || "");

        if (!map.has(key)) {
            map.set(key, {
                title: item.title,
                link: item.link,
                priceMin: price?.min || null,
                priceMax: price?.max || null,
                desc: item.snippet
            });
        } else {
            const existing = map.get(key);
            if (price) {
                existing.priceMin = existing.priceMin ? Math.min(existing.priceMin, price.min) : price.min;
                existing.priceMax = existing.priceMax ? Math.max(existing.priceMax, price.max) : price.max;
            }
        }
    });

    // TL formatına çevir
    return Array.from(map.values()).map(p => ({
        title: p.title,
        link: p.link,
        price: formatPriceRange(p.priceMin, p.priceMax),
        snippet: p.desc
    }));
}

// 🔹 İsim normalizasyonu (aynı ürün eşleşmesi)
function normalizeName(name: string) {
    return name.toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9ğüşöçı]/g, ""); // TR harf destekli
}

// 🔹 Fiyat parse etme
function parsePrice(priceStr: string) {
    if (!priceStr) return null;
    const match = priceStr.match(/([\d\.]+)\s*tl/i);
    if (!match) return null;
    const val = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
    return { min: val, max: val };
}

// 🔹 TL fiyat formatlama
function formatPriceRange(min: number | null, max: number | null) {
    if (!min && !max) return null;
    if (min === max) return `${min?.toLocaleString("tr-TR")} TL`;
    return `${min?.toLocaleString("tr-TR")} TL - ${max?.toLocaleString("tr-TR")} TL`;
}
