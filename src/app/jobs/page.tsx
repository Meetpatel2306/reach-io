"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, FileText, Users, FileBox, Bell, Plus } from "lucide-react";
import { fetchContacts, fetchFollowUps, fetchHistory, fetchResumes, fetchTemplates } from "./_lib/client";
import type { FollowUpEntry, SendRecord } from "@/lib/jobAppShared";

export default function JobsDashboard() {
  const [stats, setStats] = useState({ templates: 0, contacts: 0, resumes: 0, sent: 0, failed: 0 });
  const [followUps, setFollowUps] = useState<FollowUpEntry[]>([]);
  const [recent, setRecent] = useState<SendRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tpls, contacts, resumes, history, fu] = await Promise.all([
          fetchTemplates(),
          fetchContacts(),
          fetchResumes(),
          fetchHistory(),
          fetchFollowUps(7),
        ]);
        setStats({
          templates: tpls.length,
          contacts: contacts.length,
          resumes: resumes.length,
          sent: history.filter((h) => h.status === "sent").length,
          failed: history.filter((h) => h.status === "failed").length,
        });
        setFollowUps(fu);
        setRecent(history.slice(0, 5));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-slate-400">Send personalised job applications. Track follow-ups. Never lose a thread.</p>
        </div>
        <Link href="/jobs/send" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium">
          <Send className="w-4 h-4" /> Send application
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<FileText className="w-4 h-4" />} label="Templates" value={stats.templates} href="/jobs/templates" />
        <StatCard icon={<Users className="w-4 h-4" />} label="Contacts" value={stats.contacts} href="/jobs/contacts" />
        <StatCard icon={<FileBox className="w-4 h-4" />} label="Resumes" value={stats.resumes} href="/jobs/resumes" />
        <StatCard icon={<Send className="w-4 h-4" />} label="Sent" value={stats.sent} href="#" />
        <StatCard icon={<Bell className="w-4 h-4" />} label="Follow-ups due" value={followUps.length} href="/jobs/followups" highlight={followUps.length > 0} />
      </div>

      {/* Smart suggestion: pending follow-ups */}
      {followUps.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-200">{followUps.length} follow-up{followUps.length === 1 ? "" : "s"} recommended</h3>
              <p className="text-sm text-amber-100/70">
                You haven&apos;t followed up on these applications in 7+ days.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {followUps.slice(0, 5).map((fu) => (
                  <li key={fu.id} className="text-amber-100/90">
                    <span className="font-medium">{fu.contactName || fu.contactEmail}</span>
                    <span className="text-amber-100/60"> — {fu.role || "—"} at {fu.company || "—"}</span>
                    <span className="text-amber-100/60"> · sent {fu.daysSinceSent} days ago with </span>
                    <span className="text-amber-100/90 italic">{fu.resumeLabel || "no resume"}</span>
                  </li>
                ))}
              </ul>
              <Link href="/jobs/followups" className="inline-block mt-3 text-amber-300 hover:text-amber-200 text-sm font-medium">
                Review &amp; send follow-ups →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-3">
        <ActionCard href="/jobs/contacts" icon={<Plus className="w-4 h-4" />} title="Add a contact" desc="Save email, name, company, role for one-click sends." />
        <ActionCard href="/jobs/resumes" icon={<FileBox className="w-4 h-4" />} title="Upload a resume" desc="Tag with role-type to auto-attach the right one." />
        <ActionCard href="/jobs/templates" icon={<FileText className="w-4 h-4" />} title="Customise templates" desc="Templates are pre-loaded — edit anytime." />
      </div>

      {/* Recent sends */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Recent sends</h3>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-slate-500 text-sm">Nothing sent yet.</p>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Recipient</th>
                  <th className="text-left p-3">Company</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="p-3 text-slate-400">{new Date(r.sentAt).toLocaleString()}</td>
                    <td className="p-3">{r.contactName || r.contactEmail}</td>
                    <td className="p-3 text-slate-300">{r.company || "—"}</td>
                    <td className="p-3 text-slate-300">{r.role || "—"}</td>
                    <td className="p-3">
                      <span className={r.status === "sent" ? "text-emerald-400" : "text-rose-400"}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, href, highlight }: { icon: React.ReactNode; label: string; value: number; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`block rounded-lg border p-4 transition ${highlight ? "border-amber-500/50 bg-amber-500/10" : "border-slate-800 bg-slate-900/40 hover:bg-slate-900/70"}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold ${highlight ? "text-amber-200" : "text-slate-100"}`}>{value}</div>
    </Link>
  );
}

function ActionCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 p-4 transition">
      <div className="flex items-center gap-2 text-indigo-300 mb-1">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-sm text-slate-400">{desc}</p>
    </Link>
  );
}
