import { VertexAI } from "@google-cloud/vertexai";

const project = process.env.GOOGLE_CLOUD_PROJECT || "ai-compare";
const location = process.env.GOOGLE_CLOUD_REGION || "us-central1";

const vertexAI = new VertexAI({ project, location });

export async function analyzeWithVertex(products: any[], query: string) {
    const models = [
        { name: "gemini-2.5-pro", maxOutputTokens: 2000 },
        { name: "gemini-2.5-flash", maxOutputTokens: 1000 },
    ];

    // Ürün listesini kısa formatta hazırla
    const productList = products
        .map(
            (p, i) =>
                `${i + 1}) ${p.title || p.name} — ${p.price || "Fiyat yok"} — ${p.link}`
        )
        .join("\n");

    // Sade prompt
    const prompt = `
Kullanıcı şu sorguyu yaptı: "${query}".

Aşağıdaki ürün listesine bak ve sadece en uygun olan 3 ürünü listele:
- Marka & Model adı
- Kısa açıklama (en fazla 1 cümle)
- Fiyat bilgisi
- Link

Sadece bu bilgileri ver, fazladan analiz, giriş, ya da uzun açıklama ekleme.
Ürün listesi:
${productList}
`;

    for (const model of models) {
        try {
            const generativeModel = vertexAI.getGenerativeModel({
                model: model.name,
                generationConfig: {
                    maxOutputTokens: model.maxOutputTokens,
                    temperature: 0.3, // Daha stabil sonuç için düşük temperature
                },
            });

            const result = await generativeModel.generateContent(prompt);
            const response = result.response;

            if (
                response &&
                response.candidates &&
                response.candidates.length > 0 &&
                response.candidates[0].content.parts &&
                response.candidates[0].content.parts[0].text
            ) {
                return response.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            console.error(`[${model.name}] HATA`, err);
        }
    }

    return "Analiz yapılamadı. Lütfen daha sonra tekrar deneyin.";
}
