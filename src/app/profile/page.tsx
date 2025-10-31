export default function ProfilePage() {
  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200" />
          <div>
            <p className="font-medium">Your Name</p>
            <p className="text-xs text-gray-600">They/Them · Androgynous</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-md border px-3 py-2">Edit Identity</button>
          <button className="rounded-md border px-3 py-2">Preferences</button>
        </div>
      </div>
    </section>
  );
}
