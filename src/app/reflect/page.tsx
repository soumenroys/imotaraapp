export default function ReflectPage() {
  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Reflect</h1>
      <div className="space-y-2">
        <div className="max-w-[85%] rounded-lg bg-gray-100 p-3 text-sm">
          Hey there! How was your day?
        </div>
        <div className="ml-auto max-w-[85%] rounded-lg bg-gray-900 p-3 text-sm text-white">
          It was good… I went for a nice walk.
        </div>
      </div>
      <div className="sticky bottom-20 flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" placeholder="Message…" />
        <button className="rounded-md bg-gray-900 px-4 py-2 text-white">Send</button>
      </div>
    </section>
  );
}
