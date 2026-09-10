export const metadata = {
  title: "Chat — Imotara",
  description:
    "A calm space to talk. Your words are processed with care and never sold.",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The chat is the only page that wants the whole screen. The shared <main>
  // wrapper adds px-4 py-4 pb-8 (sm:py-10) around every page, which on a laptop
  // is ~72px of vertical padding wrapped around a conversation that is already
  // short. Cancelling it HERE keeps the change to this route — every other page
  // keeps its breathing room.
  //
  // Horizontally, main also clamps every page to max-w-5xl (1024px). For a
  // document that is a sensible reading measure; for the chat it left 576px
  // unused on a 1600px window and 896px on a 1920px one — 36% and 47% of the
  // screen — while the chat's own wrapper was asking for max-w-7xl and never
  // getting it.
  //
  // mx-[calc(50%-50vw)] is the full-bleed escape: it pulls the element out to
  // the viewport edges from inside a centred, max-width parent, without a
  // transform (which would take it out of flow and break the sticky header).
  // The chat's own max-w-7xl then re-centres it at 1280px, so this widens the
  // conversation without letting it sprawl on a large monitor.
  //
  // body already sets overflow-x-hidden, so the vw-vs-% scrollbar difference
  // cannot produce a horizontal scrollbar.
  return (
    <div className="-mt-4 -mb-8 sm:-mt-10 sm:-mb-10 mx-[calc(50%-50vw)] px-3 sm:px-4">
      {children}
    </div>
  );
}
