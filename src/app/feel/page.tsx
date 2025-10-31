export default function FeelPage() {
  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Feel</h1>
      <div className="rounded-lg border p-3">
        <label className="block text-sm text-gray-600 mb-2">How are you feeling today?</label>
        <textarea
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring"
          rows={4}
          placeholder="What's on your mind?"
        />
        <div className="mt-2 flex justify-end">
          <button className="rounded-md bg-gray-900 px-4 py-2 text-white">Save</button>
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-sm text-gray-600">Recent posts (sample)</p>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="rounded-md bg-gray-50 p-2">Feeling grateful for small wins 🙂</li>
          <li className="rounded-md bg-gray-50 p-2">Took a relaxing walk in the park</li>
        </ul>
      </div>
    </section>
  );
}
