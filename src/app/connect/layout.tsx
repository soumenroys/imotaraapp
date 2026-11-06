import { brandTitle } from "@/lib/seo/brandTitle";
export const metadata = {
  title: brandTitle("Connect — Imotara"),
  description:
    "Ways to reach the Imotara team for feedback, partnerships, or support.",
};

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
