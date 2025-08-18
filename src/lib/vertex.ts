// src/lib/vertex.ts
import { VertexAI } from "@google-cloud/vertexai";

export type Source = { url: string; price?: number | null };
export type Product = {
    name: string;
    sources: Source[];
    price?: { min: number | null; max: number | null; currency: "TRY" };
    specs: Record<string, any>;
};

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "";
const REGION = process.env.GOOGLE_CLOUD_REGION || "us-central1";

// ✅ Stabil model: us-central1'da kesin çalışıyor
const MODEL_ID = process.env.VERTEX_MODEL || "gemini-2.0-flash";

/* ------------------ Yanıt metni çıkarıcı ------------------ */
function deepFindText(obj: any): string {
    try {
        const seen = new Set<any>();
        const stack = [obj];
        while (stack.length) {
            const cur = stack.pop();
            if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
            seen.add(cur);

            if (typeof (cur as any).output_text === "string" && (cur as any).output_text.trim()) {
                return (cur as any).output_text;
            }
            if (typeof (cur as any).text === "string" && (cur as any).text.trim()) {
                return (cur as any).text;
            }

            for (const k of Object.keys(cur)) {
                const v = (cur as any)[k];
                if (typeof v === "string" && k.toLowerCase().includes("text") && v.trim()) return v;
                if (Array.isArray(v)) for (const it of v) stack.push(it);
                else if (v && typeof v === "object") stack.push(v);
            }
        }
    } catch { }
    return "";
}

export function readVertexText(resp: any): string {
    try {
        const r = resp?.response ?? resp ?? {};
        const parts = r?.candidates?.[0]?.content?.parts ?? r?.response?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts) && parts.length) {
            const joined = parts.map((p: any) => p?.text ?? p?.stringValue ?? "")
                .filter(Boolean).join(" ").trim();
            if (joined) return joined;
        }
        const direct =
            (typeof r.output_text === "string" && r.output_text.trim() && r.output_text) ||
            (typeof r.text === "string" && r.text.trim() && r.text) ||
            deepFindText(r);
        if (direct) return String(direct);
    } catch { }
    return "";
}

/* ------------------ Public API ------------------ */
export async function analyzeWithVertex(items: Product[], criteria: string): Promise<string> {
    if (!GCP_PROJECT) throw new Error("GOOGLE_CLOUD_PROJECT missing");

    const rows = items.slice(0, 10).map((p, i) => {
        const price = typeof p.price?.min === "number" ? `${p.price!.min} TL` : "—";
        const s = p.specs || {};
        const specBrief = [
            s?.dpi ? `DPI:${s.dpi}` : null,
            s?.weight_g ? `Ağırlık:${s.weight_g}g` : null,
            s?.connection ? `Bağlantı:${s.connection}` : null,
        ].filter(Boolean).join(", ");
        const url = p.sources?.[0]?.url || "";
        return `${i + 1}. ${p.name} | ${price} | ${specBrief} | ${url}`;
    });

    const prompt = `
Kriter: "${criteria}"
Aşağıda TR e-ticaret sitelerinden fiyatı doğrulanmış adaylar (max 10):

${rows.join("\n")}

Görev:
- En iyi 3 adayı sırala (1→3), her biri için 1 cümle gerekçe yaz.
- Özellik (DPI, ağırlık, bağlantı) + fiyat uygunluğuna dayan.
- Her satırın sonuna "→ Link:" ile tek ürün linki koy.
Biçim:
1) <Model> — <kısa gerekçe>. Fiyat: <X TL>. → Link: <URL>
2) ...
3) ...
`.trim();

    const ai = new VertexAI({ project: GCP_PROJECT, location: REGION });
    const model = ai.getGenerativeModel({ model: MODEL_ID });

    // 1) text/plain dene
    const r1 = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.2, /* @ts-ignore */ responseMimeType: "text/plain" },
    });
    let text = readVertexText(r1).trim();

    // 2) default MIME fallback
    if (!text) {
        const r2 = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
        });
        text = readVertexText(r2).trim();
    }

    return text || "Öneri üretilemedi.";
}
