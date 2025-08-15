// src/types.ts
export interface AIResponse {
    text: string;
    sources?: { name?: string; url: string }[];
}

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    createdAt?: Date;
}

// Serper "shopping" sonuçları için temel alanlar
export interface ProductSearchResult {
    title: string;
    link: string;
    source?: string;   // "shopping" | "web" gibi (opsiyonel)
    price?: string;    // "₺1.599" gibi metin
    rating?: number;
    reviews?: string;
    position?: number;
    thumbnail?: string;

    // normalize.ts ile ekleyeceğiz:
    priceNum?: number;
    dpi?: number;
    weight?: number;
}

export interface Criteria {
    connection?: "any" | "wireless" | "wired";
    maxWeight?: number;
    minDpi?: number;
    budget?: [number, number];
    brands?: string[];
}
