export default function ProductChatCard({ p }: { p: any }) {
    return (
        <div className="border rounded-lg p-3 bg-gray-50 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-1">{p.name}</h4>
            <div className="text-sm text-gray-700 space-y-1">
                {p.price?.min && (
                    <div>💰 {p.price.min.toLocaleString("tr-TR")} TL</div>
                )}
                {p.specs?.dpi && <div>🎯 DPI: {p.specs.dpi}</div>}
                {p.specs?.weight_g && <div>⚖️ {p.specs.weight_g} g</div>}
                {p.specs?.connection && <div>🔌 {p.specs.connection}</div>}
            </div>
            {p.sources?.[0]?.url && (
                <a
                    href={p.sources[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-green-600 hover:underline text-xs"
                >
                    Siteye Git →
                </a>
            )}
        </div>
    );
}
