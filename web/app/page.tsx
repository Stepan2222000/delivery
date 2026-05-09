import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-mock";

export default async function Index() {
  const u = await getSession();
  if (!u) redirect("/login");
  redirect(u.role === "admin" ? "/admin" : "/forwarder");
}
