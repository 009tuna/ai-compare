export default function ProductCard({ p }: { p: any }) {
  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
      <h3 className="font-semibold text-gray-800 mb-2">{p.name}</h3>

      <ul className="text-sm text-gray-700 space-y-1">
        {typeof p?.price?.min === "number" && (
          <li>💰 <strong>{p.price.min.toLocaleString("tr-TR")}</strong> TL</li>
        )}
        {typeof p?.specs?.dpi === "number" && (
          <li>🎯 DPI: <strong>{p.specs.dpi}</strong></li>
        )}
        {typeof p?.specs?.weight_g === "number" && (
          <li>⚖️ Ağırlık: <strong>{p.specs.weight_g} g</strong></li>
        )}
        {p?.specs?.connection && (
          <li>🔌 Bağlantı: <strong>{p.specs.connection}</strong></li>
        )}
      </ul>

      {p?.sources?.[0]?.url && (
        <a
          href={p.sources[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-green-600 hover:underline text-sm"
        >
          Siteye Git →
        </a>
      )}
    </div>
  );
}
