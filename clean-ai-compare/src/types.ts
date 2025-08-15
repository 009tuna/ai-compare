// src/types.ts

// Örnek: API cevabı tipleri
export interface AIResponse {
    model: string;
    content: string;
    timestamp: string;
}

// Örnek: Arama sonuçları tipleri
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

// Örnek: Chat mesajları tipleri
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: Date;
}
