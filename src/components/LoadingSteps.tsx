export function LoadingSteps({ stage }: { stage: number }) {
    // 0..3
    const steps = ["Aranıyor", "Sayfalar inceleniyor", "Fiyatlar doğrulanıyor", "Özetleniyor"];

    return (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            {steps.map((s, i) => {
                const done = i < stage;
                const active = i === stage;
                return (
                    <div key={i} className="flex items-center gap-2">
                        <span
                            className={[
                                "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                                done
                                    ? "bg-green-600 text-white border-green-600"
                                    : active
                                        ? "bg-white text-gray-600 border-green-600"
                                        : "bg-white text-gray-400 border-gray-300",
                            ].join(" ")}
                            aria-hidden
                        >
                            {done ? "✓" : active ? "…" : i + 1}
                        </span>
                        <span className={active ? "animate-pulse" : ""}>{s}</span>
                        {i < steps.length - 1 && <span className="text-gray-300">—</span>}
                    </div>
                );
            })}
        </div>
    );
}
