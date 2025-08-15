import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata = {
  title: "AI Compare",
  description: "Akıllı ürün karşılaştırma ve fiyat analizi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <NavBar />
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
