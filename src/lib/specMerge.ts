// src/lib/specMerge.ts
export type Evidenced<T> = { value: T | null; source?: string; confidence: "high" | "medium" | "low" };

export function chooseWeight(cands: Evidenced<number>[]): number | undefined {
    const sane = cands
        .filter(c => typeof c.value === "number" && c.value! >= 20 && c.value! <= 200)
        .sort((a, b) => confScore(b.confidence) - confScore(a.confidence));
    return sane[0]?.value ?? undefined;
}

function confScore(c: Evidenced<any>["confidence"]) {
    if (c === "high") return 3;
    if (c === "medium") return 2;
    return 1;
}
