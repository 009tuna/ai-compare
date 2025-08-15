import PageFade from "@/components/PageFade";
import Link from "next/link";

export default function Page() {
  return (
    <PageFade>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 p-1 shadow-xl">
            <div className="rounded-3xl bg-white/90 p-8 dark:bg-slate-950/80">
              <h1 className="mb-3 text-3xl font-extrabold leading-tight md:text-4xl">
                Sezgisel karşılaştırma <span className="underline decoration-wavy decoration-cyan-400"></span>
              </h1>
              <p className="mb-6 text-slate-600 dark:text-slate-300">
                AI, Türkiye e-ticaret sitelerinden çektiği verileri işler; fiyat ve önemli özellikleri tek listede sunar.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/chat" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-95 active:scale-95 dark:bg-white dark:text-slate-900">
                  🚀 Chatbot
                </Link>
                <Link href="/search" className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-900">
                  🔍 Akıllı Arama
                </Link>
              </div>
              <ul className="mt-6 grid list-disc gap-2 pl-6 text-sm text-slate-700 dark:text-slate-300">
                <li>TR-only arama · otomatik birleştirme</li>
                <li>Fiyat aralığı & önemli özellikler</li>
                <li>Hafif, hızlı, modern arayüz</li>
              </ul>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-slate-500">Örnek Sorgular</h3>
          <ul className="space-y-2 text-sm">
            <li>• 55g altı kablosuz mouse — 1500–3000 TL</li>
            <li>• Mekanik klavye — sessiz switch — 2000 TL altı</li>
            <li>• ANC kulaklık — 5000–8000 TL</li>
          </ul>
        </aside>
      </section>
    </PageFade>
  );
}
