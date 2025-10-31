export default function GrowPage() {
  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Grow</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-sm text-gray-600">Stress</p>
          <p className="text-2xl font-semibold">2</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm text-gray-600">Motivation</p>
          <p className="text-2xl font-semibold">7</p>
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-sm text-gray-600 mb-2">Reflection prompt</p>
        <p className="rounded-md bg-gray-50 p-2 text-sm">
          What energized you at work today?
        </p>
      </div>
    </section>
  );
}
