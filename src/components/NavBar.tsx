"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";

const tabs = [
    { href: "/", label: "Anasayfa" },
    { href: "/chat", label: "Chatbot" },
    { href: "/search", label: "Akıllı Arama" },
];

export default function NavBar() {
    const pathname = usePathname();
    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow">
                        <span className="text-lg font-bold">AI</span>
                    </div>
                    <div>
                        <div className="text-xl font-extrabold tracking-tight">Compare</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Akıllı Karşılaştırma</div>
                    </div>
                </Link>

                <nav className="relative flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {tabs.map((t) => {
                        const active = pathname === t.href;
                        return (
                            <Link
                                key={t.href}
                                href={t.href}
                                className={clsx(
                                    "relative rounded-full px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200",
                                    active && "text-slate-900 dark:text-slate-50"
                                )}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="pill"
                                        className="absolute inset-0 -z-10 rounded-full bg-slate-900 dark:bg-slate-100"
                                        transition={{ type: "spring", duration: 0.5 }}
                                    />
                                )}
                                <span className={active ? "text-white dark:text-slate-900" : ""}>{t.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
