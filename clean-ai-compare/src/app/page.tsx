export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">AI Compare</h1>
      <p className="text-slate-600">Chatbot ya da Manuel Sorgu ile ürün karşılaştır.</p>
      <div className="mt-4 flex gap-3">
        <a className="underline" href="/chat">Chatbot</a>
        <a className="underline" href="/search">Manuel Sorgu</a>
      </div>
    </main>
  );
}
