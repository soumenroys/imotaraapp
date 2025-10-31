export default function ConnectPage() {
  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Connect</h1>
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200" />
          <div>
            <p className="font-medium">Evan</p>
            <p className="text-xs text-gray-600">Calm & Curious</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="rounded-md bg-gray-900 px-4 py-2 text-white">Connect</button>
          <button className="rounded-md border px-4 py-2">Chat</button>
        </div>
      </div>
    </section>
  );
}
