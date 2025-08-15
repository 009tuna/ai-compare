"use client";
import { useState, useRef, useEffect } from "react";
import ProductCard from "@/components/ProductCard";
import { LoadingSteps } from "@/components/LoadingSteps";

type Msg = { role: "user" | "assistant"; text: string; products?: any[] };

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
            // 1) Assistant metni (senin mevcut /api/analyze endpoint’in)
            setStage(0);
            const aRes = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: q }),
            });
            const aJson = await aRes.json();
            const assistantText = (aJson?.text || aJson?.answer || "Özet hazırlanıyor...").toString();

            // 2) Ürün araması (bizim /api/search → bands.top10)
            setStage(1);
            const sRes = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            setStage(2);
            const sJson = await sRes.json();
            const top10 = sJson?.bands?.top10 ?? [];

            // 3) Mesajı yaz
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
        <div className="max-w-6xl mx-auto p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-4">Chatbot</h1>

            {/* Mesaj listesi */}
            <div
                ref={listRef}
                className="h-[60vh] border rounded-2xl bg-white shadow-sm p-4 overflow-y-auto space-y-3"
            >
                {msgs.length === 0 && (
                    <div className="text-gray-500 text-sm">
                        Örn: <em>“1500–3000 TL arası kablosuz, 60g altı mouse öner”</em>
                    </div>
                )}

                {msgs.map((m, i) => (
                    <div
                        key={i}
                        className={
                            "max-w-[90%] rounded-2xl px-3 py-2 " +
                            (m.role === "user"
                                ? "ml-auto bg-green-600 text-white"
                                : "bg-gray-50 border")
                        }
                    >
                        <p className="whitespace-pre-wrap leading-6">{m.text}</p>

                        {/* Assistant ürün kartları */}
                        {m.role === "assistant" && Array.isArray(m.products) && m.products.length > 0 && (
                            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {m.products.map((p: any, idx: number) => (
                                    <ProductCard key={idx} p={p} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Yüklenme adımları */}
                {sending && (
                    <div className="bg-gray-50 border rounded-2xl px-3 py-2">
                        <LoadingSteps stage={stage} />
                    </div>
                )}
            </div>

            {/* Giriş alanı */}
            <div className="mt-4 flex gap-2">
                <input
                    className="flex-1 border rounded-xl px-4 py-3"
                    placeholder="Sorunu yaz (örn: 2.000 TL altı, kablosuz, 60g altı mouse)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? ask() : null)}
                />
                <button
                    onClick={ask}
                    disabled={sending}
                    className="rounded-xl bg-green-600 text-white px-5 py-3 hover:bg-green-700 disabled:opacity-50"
                >
                    Gönder
                </button>
            </div>
        </div>
    );
}
