import { VertexAI } from "@google-cloud/vertexai";
import { ProductSearchResult, Criteria } from "@/types";

const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT;

const location = process.env.GOOGLE_CLOUD_REGION || "us-central1"; // 2.5 Pro için genelde US

const PREFERRED_MODEL = "gemini-2.5-pro";
const FALLBACK_MODEL = "gemini-1.5-pro-002";

function buildPrompt(items: ProductSearchResult[], criteria?: Criteria) {
    const crit = criteria ? `Kriterler: ${JSON.stringify(criteria)}` : "Kriterler: (belirtilmedi)";
    return `Aşağıdaki mouse ürünlerini karşılaştır ve öner:

${crit}

Ürünler (Serper):
${JSON.stringify(items.slice(0, 8), null, 2)}

Şu çıktıyı üret:
- 3 öneri (Model — kısa neden)
- Fiyat bandı: aynı / daha ucuz / bir tık pahalı (tahmin)
- Tablo: Model | Tahmini Fiyat | Ağırlık | DPI | Bağlantı (bilgi yoksa "—")
- 3 kaynak linki (varsa)`;
}

export async function analyzeWithVertex(
    items: ProductSearchResult[],
    criteria?: Criteria
): Promise<string> {
    if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT is undefined");

    const vertex = new VertexAI({ project: projectId, location });
    const prompt = buildPrompt(items, criteria);

    try {
        const model = vertex.getGenerativeModel({ model: PREFERRED_MODEL });
        const r = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
        const text = r?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) return text;
        throw new Error("Empty response");
    } catch (e) {
        console.warn("2.5 Pro failed, falling back to 1.5 Pro:", e);
        const model = vertex.getGenerativeModel({ model: FALLBACK_MODEL });
        const r = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
        const text = r?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!text) throw new Error("Vertex response empty");
        return text;
    }
}
