import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { JobsNav } from "./_components/Nav";

export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.email) {
    redirect("/login?next=/jobs");
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <JobsNav />
      <main className="flex-1 p-4 md:p-8 max-w-6xl">{children}</main>
    </div>
  );
}
