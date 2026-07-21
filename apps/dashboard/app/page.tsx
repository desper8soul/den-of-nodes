import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { ToastProvider } from "@/components/Toast";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}
