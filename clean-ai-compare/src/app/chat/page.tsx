"use client";
import { useState } from "react";
import type { ProductSearchResult, Criteria } from "@/types";

export default function ChatPage() {
    const [q, setQ] = useState("hafif kablosuz mouse 1500-3000 TL");
    const [analysis, setAnalysis] = useState("");

    const run = async () => {
        setAnalysis("Aranıyor...");
        const s = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await s.json();
        const items = (j.shopping_results || []) as ProductSearchResult[];
        const criteria: Criteria = { connection: "wireless", maxWeight: 65 };

        const a = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items, criteria }),
        });
        const aj = await a.json();
        setAnalysis(aj.analysis || aj.message || "Analiz alınamadı.");
    };

    return (
        <main className="p-6 space-y-3">
            <h2 className="text-xl font-semibold">Chatbot</h2>
            <input
                className="border px-3 py-2 rounded w-full max-w-xl"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ör: 55g altı kablosuz mouse 1500-2500 TL"
            />
            <button className="px-4 py-2 bg-black text-white rounded" onClick={run}>
                Gönder
            </button>
            <pre className="whitespace-pre-wrap border p-3 rounded mt-3">{analysis}</pre>
        </main>
    );
}
