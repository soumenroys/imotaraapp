import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root route "/" → "/feel"
  redirect("/feel");
}
