export default function LoadingDots({ label = "Yükleniyor..." }: { label?: string }) {
    return (
        <div className="inline-flex items-center gap-2 text-slate-500">
            <span className="sr-only">{label}</span>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        </div>
    );
}
