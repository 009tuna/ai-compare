// Kategori bazlı özellik şemaları ve extract pattern'leri
export type Category = "mouse" | "klavye" | "kulaklik";

export type SpecDef = {
    key: string;                    // "dpi", "weight_g" ...
    label: string;                  // UI etiketi
    type: "number" | "string" | "boolean";
    patterns: RegExp[];             // sayfa metninde arama için
    post?: (raw: string) => any;    // parse/normalize
};

export const SPEC_SCHEMAS: Record<Category, SpecDef[]> = {
    mouse: [
        {
            key: "dpi", label: "DPI", type: "number",
            patterns: [/(\d{4,6})\s*(?:dpi)/i, /(8k|16k|26k|30k)\s*dpi/i],
            post: (s) => Number(String(s).replace(/[^\d]/g, ""))
        },
        {
            key: "weight_g", label: "Ağırlık (g)", type: "number",
            patterns: [/(\d{2,3})\s*g(?:ram)?/i, /ağırlık[:\s]*?(\d{2,3})/i],
            post: (s) => Number(String(s).replace(/[^\d]/g, ""))
        },
        {
            key: "connection", label: "Bağlantı", type: "string",
            patterns: [/kablosuz|wireless/i, /kablolu|wired/i],
            post: (m) => /kablosuz|wireless/i.test(m) ? "kablosuz" : "kablolu"
        }
    ],
    klavye: [
        { key: "switch", label: "Switch", type: "string", patterns: [/linear|tactile|clicky|silent/i] },
        { key: "layout", label: "Layout", type: "string", patterns: [/(full|tkl|75%|60%)/i] },
        { key: "connection", label: "Bağlantı", type: "string", patterns: [/kablosuz|wireless|kablolu|wired/i] }
    ],
    kulaklik: [
        { key: "anc", label: "ANC", type: "boolean", patterns: [/aktif\s*gürültü\s*engelleme|anc/i], post: () => true },
        { key: "driver_mm", label: "Sürücü (mm)", type: "number", patterns: [/(\d{2})\s*mm/i], post: (s) => Number(String(s).replace(/[^\d]/g, "")) },
        { key: "connection", label: "Bağlantı", type: "string", patterns: [/bluetooth|kablosuz|kablolu|3\.5mm|usb/i] }
    ]
};
