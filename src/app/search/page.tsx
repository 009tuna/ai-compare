"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";

type Bands = {
  top10?: any[];
  same_price_better?: any[];
  cheaper_similar?: any[];
  slightly_higher_much_better?: any[];
};

type ApiResp = {
  query: string;
  category: string;
  products: any[];
  bands: Bands;
};

type Connection = "any" | "kablosuz" | "kablolu";

export default function SearchPage() {
  // Serbest query
  const [query, setQuery] = useState("");

  // Filtre paneli
  const [category, setCategory] = useState<"mouse" | "klavye" | "kulaklik">("mouse");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [connection, setConnection] = useState<Connection>("any");
  const [maxWeight, setMaxWeight] = useState<number | "">("");
  const [minDpi, setMinDpi] = useState<number | "">("");
  const [budgetMin, setBudgetMin] = useState<number | "">("");
  const [budgetMax, setBudgetMax] = useState<number | "">("");
  const [strictTR, setStrictTR] = useState(true);

  // Data state
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtrelerden sorgu metni üret (kullanıcı serbest metin yazmadıysa)
  const composedQuery = useMemo(() => {
    const parts: string[] = [];
    if (brand) parts.push(brand);
    if (model) parts.push(model);
    // kategoriye göre isteğe bağlı anahtar kelime
    if (category === "mouse") parts.push("mouse");
    if (connection === "kablosuz") parts.push("kablosuz");
    if (connection === "kablolu") parts.push("kablolu");
    if (typeof maxWeight === "number") parts.push(`${maxWeight} g altı`);
    if (typeof minDpi === "number") parts.push(`${minDpi} dpi`);
    if (typeof budgetMin === "number" || typeof budgetMax === "number") {
      const lo = typeof budgetMin === "number" ? budgetMin : 0;
      const hi = typeof budgetMax === "number" ? budgetMax : 999999;
      parts.push(`${lo}-${hi} TL`);
    }
    return parts.join(" ").trim();
  }, [brand, model, category, connection, maxWeight, minDpi, budgetMin, budgetMax]);

  async function doSearch(finalQuery: string) {
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const params = new URLSearchParams();
      params.set("q", finalQuery);
      params.set("category", category);
      if (strictTR) params.set("strict", "1");
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResp;
      setResp(json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Üstteki “Ara” butonu → serbest metin; boşsa filtreden üretilen metni kullan
  const handleSearchBar = () => {
    const q = query.trim() || composedQuery;
    if (!q) return;
    doSearch(q);
  };

  // Sol panel “Ara” → her zaman filtre metnini kullan
  const handleFilterSearch = () => {
    if (!composedQuery) return;
    doSearch(composedQuery);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sol: Filtre Paneli */}
      <aside className="lg:col-span-1 space-y-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold mb-3">Akıllı Arama</h2>

          <label className="block text-xs text-gray-500 mb-1">Ürün Tipi</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
          >
            <option value="mouse">Mouse</option>
            <option value="klavye">Klavye</option>
            <option value="kulaklik">Kulaklık</option>
          </select>

          <label className="block text-xs text-gray-500 mb-1">Marka (opsiyonel)</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="Örn: Logitech"
          />

          <label className="block text-xs text-gray-500 mb-1">Model (opsiyonel)</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="Örn: G305"
          />

          <label className="block text-xs text-gray-500 mb-1">Bağlantı</label>
          <select
            value={connection}
            onChange={(e) => setConnection(e.target.value as Connection)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
          >
            <option value="any">Farketmez</option>
            <option value="kablosuz">Kablosuz</option>
            <option value="kablolu">Kablolu</option>
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Ağırlık (g)</label>
              <input
                type="number"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value ? Number(e.target.value) : "")}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min DPI</label>
              <input
                type="number"
                value={minDpi}
                onChange={(e) => setMinDpi(e.target.value ? Number(e.target.value) : "")}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bütçe Min (₺)</label>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value ? Number(e.target.value) : "")}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bütçe Max (₺)</label>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value ? Number(e.target.value) : "")}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={strictTR}
              onChange={(e) => setStrictTR(e.target.checked)}
            />
            Sadece TR siteleri (TR-only)
          </label>

          <button
            onClick={handleFilterSearch}
            className="mt-4 w-full rounded-xl bg-green-600 text-white px-4 py-2 font-semibold hover:bg-green-700"
          >
            Ara
          </button>

          <p className="mt-3 text-xs text-gray-500">
            Oluşan sorgu: <span className="font-mono">{composedQuery || "—"}</span>
          </p>
        </div>
      </aside>

      {/* Sağ: Sonuçlar */}
      <main className="lg:col-span-3 space-y-6">
        {/* Üst hızlı arama */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün ara (örn: 8000 dpi kablosuz mouse)"
              className="flex-1 border rounded-lg px-4 py-2"
            />
            <button
              onClick={handleSearchBar}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Ara
            </button>
          </div>
          {loading && (
            <div className="mt-3 text-sm text-gray-500 animate-pulse">🔍 Aranıyor…</div>
          )}
          {error && (
            <div className="mt-3 text-sm text-red-600">Hata: {error}</div>
          )}
        </div>

        {/* Top 10 */}
        {resp?.bands?.top10 && resp.bands.top10.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3">🏆 En İyi 10</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resp.bands.top10.map((p, idx) => (
                <ProductCard key={idx} p={p} />
              ))}
            </div>
          </section>
        )}

        {/* Bantlar */}
        {resp?.bands && (
          <section className="space-y-8">
            <BandSection title="💰 Aynı Fiyat Bandında Daha İyi" products={resp.bands.same_price_better || []} />
            <BandSection title="📉 Daha Ucuz, Benzer Performans" products={resp.bands.cheaper_similar || []} />
            <BandSection title="📈 Biraz Daha Pahalı, Çok Daha İyi" products={resp.bands.slightly_higher_much_better || []} />
          </section>
        )}
      </main>
    </div>
  );
}

function BandSection({ title, products }: { title: string; products: any[] }) {
  if (!products || products.length === 0) return null;
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p, idx) => (
          <ProductCard key={idx} p={p} />
        ))}
      </div>
    </div>
  );
}
