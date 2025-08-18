// src/app/api/vertex-selftest/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { readVertexText } from "@/lib/vertex";

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "";
const REGION = process.env.GOOGLE_CLOUD_REGION || "us-central1";
const MODEL = process.env.VERTEX_MODEL || "gemini-2.0-flash";

export async function GET() {
    if (!GCP_PROJECT) {
        return NextResponse.json({ env: { googleProject: "missing" } }, { status: 500 });
    }
    const start = Date.now();
    let sample = "", ok = false, error: string | null = null;

    try {
        const ai = new VertexAI({ project: GCP_PROJECT, location: REGION });
        const model = ai.getGenerativeModel({ model: MODEL });

        const r1 = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "Sadece OK yaz." }] }],
            generationConfig: { maxOutputTokens: 6, temperature: 0, /* @ts-ignore */ responseMimeType: "text/plain" },
        });
        sample = readVertexText(r1).trim();
        if (!sample) {
            const r2 = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: "Sadece OK yaz." }] }],
                generationConfig: { maxOutputTokens: 6, temperature: 0 },
            });
            sample = readVertexText(r2).trim();
        }
        ok = /^ok\b/i.test(sample);
        if (!ok && !sample) error = "empty-text";
    } catch (e: any) {
        error = e?.message || String(e);
    }

    return NextResponse.json({
        env: { project: "present", region: REGION, model: MODEL },
        vertex: { ok, sample, error, ms: Date.now() - start },
        now: new Date().toISOString(),
    });
}
