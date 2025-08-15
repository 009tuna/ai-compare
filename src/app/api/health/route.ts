export async function GET() {
    return new Response(
        JSON.stringify({
            project: process.env.GOOGLE_CLOUD_PROJECT || null,
            region: process.env.GOOGLE_CLOUD_REGION || null,
            hasSerper: !!process.env.SERPER_API_KEY,
        }),
        { headers: { "Content-Type": "application/json" } }
    );
}