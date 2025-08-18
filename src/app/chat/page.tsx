// src/app/chat/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import ProductCard from "@/components/ProductCard";
import { LoadingSteps } from "@/components/LoadingSteps";
import type { ProductSearchResult } from "@/types";

type Msg = { role: "user" | "assistant"; text: string; products?: any[] };
type Category = "mouse" | "klavye" | "kulaklik";

function detectCategory(q: string): Category {
    const s = q.toLowerCase();
    if (/(klavye|keyboard)/i.test(s)) return "klavye";
    if (/(kulaklık|kulaklik|headset|kulak|earbud|earbuds)/i.test(s)) return "kulaklik";
    return "mouse";
}

export default function ChatPage() {
    const [input, setInput] = useState("");
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [sending, setSending] = useState(false);
    const [stage, setStage] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [msgs, sending, stage]);

    async function ask() {
        const q = input.trim();
        if (!q || sending) return;

        setMsgs((m) => [...m, { role: "user", text: q }]);
        setInput("");
        setSending(true);
        setStage(0);

        try {
            // 1) TR-only arama
            setStage(0);
            const category = detectCategory(q);
            const sRes = await fetch(
                `/api/search?q=${encodeURIComponent(q)}&category=${category}&strict=1`
            );

            if (!sRes.ok) {
                const e = await sRes.json().catch(() => ({}));
                throw new Error(e?.message || `search failed ${sRes.status}`);
            }

            const sJson = await sRes.json();
            const products: ProductSearchResult[] = Array.isArray(sJson?.products) ? sJson.products : [];
            const top10: ProductSearchResult[] = Array.isArray(sJson?.bands?.top10) ? sJson.bands.top10 : [];

            // 2) Hiç uygun ürün yoksa analyze çağırma; kullanıcıya sebeple dön
            if (!top10.length) {
                const msg =
                    sJson?.message ||
                    "Türkiye sitelerinde uygun ürün/detay sayfası bulunamadı. Arama ifadesini biraz genişlet veya marka/model adı ekle.";
                setMsgs((m) => [...m, { role: "assistant", text: msg, products }]);
                setSending(false);
                setStage(0);
                return;
            }

            // 3) Kısa analiz
            setStage(1);
            const aRes = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: top10,     // Product[]
                    criteria: q,      // string kabul edilecek (endpoint düzeltildi)
                }),
            });

            setStage(2);
            const aJson = await aRes.json();
            const assistantText =
                (aJson?.analysis || aJson?.text || aJson?.answer || "Özet hazırlanıyor...").toString();

            // 4) Mesaj (analiz + ürün kartları)
            setStage(3);
            setMsgs((m) => [...m, { role: "assistant", text: assistantText, products: top10 }]);
        } catch (e: any) {
            setMsgs((m) => [
                ...m,
                { role: "assistant", text: `Bir hata oluştu: ${e?.message || String(e)}` },
            ]);
        } finally {
            setSending(false);
            setStage(0);
        }
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-semibold mb-4">Chatbot</h1>

            <div
                ref={listRef}
                className="border rounded-xl p-4 bg-white shadow-sm h-[50vh] overflow-y-auto space-y-4"
            >
                {msgs.length === 0 && (
                    <div className="text-gray-500">
                        Örn: “1500–3000 TL arası kablosuz, 60g altı mouse öner”
                    </div>
                )}

                {msgs.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                        <div
                            className={
                                "inline-block px-3 py-2 rounded-lg " +
                                (m.role === "user" ? "bg-emerald-600 text-white" : "bg-gray-100")
                            }
                        >
                            {m.text}
                        </div>

                        {m.role === "assistant" && Array.isArray(m.products) && m.products.length > 0 && (
                            <div className="grid md:grid-cols-2 gap-4 mt-3">
                                {m.products.map((p: any, idx: number) => (
                                    <ProductCard key={idx} p={p} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {sending && (
                    <div className="mt-3">
                        <LoadingSteps stage={stage} />
                    </div>
                )}
            </div>

            <div className="mt-4 flex gap-2">
                <input
                    className="flex-1 border rounded-lg px-4 py-2"
                    placeholder="İstediğin ürünü ve özelliklerini yaz (örn: logitech 55g altı kablosuz 1500-2500 TL)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? ask() : null)}
                />
                <button
                    onClick={ask}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                    Gönder
                </button>
            </div>
        </div>
    );
}
