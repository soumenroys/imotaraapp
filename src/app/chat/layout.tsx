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
  // Vertical only. main is also max-w-5xl and centred; undoing that as well
  // would silently widen the chat, which is a different decision from the one
  // being made here.
  return <div className="-mt-4 -mb-8 sm:-mt-10 sm:-mb-10">{children}</div>;
}
