"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Save, Search } from "lucide-react";
import type { Contact } from "@/lib/jobAppShared";

export interface RecipientLite {
  name: string;
  email: string;
  company?: string;
  role?: string;
  custom1?: string;
  custom2?: string;
}

interface Props {
  currentRecipients: RecipientLite[];
  onAdd: (recipients: RecipientLite[]) => void;
}

export function ContactsPicker({ currentRecipients, onAdd }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [showAddCurrent, setShowAddCurrent] = useState(false);
  const [defaultCompany, setDefaultCompany] = useState("");
  const [defaultRole, setDefaultRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    try {
      const r = await fetch("/api/jobs/contacts", { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data.contacts)) setContacts(data.contacts);
    } catch {}
  };
  useEffect(() => { refresh(); }, []);

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return [c.email, c.name, c.company, c.role].some((f) => (f || "").toLowerCase().includes(s));
  });

  function toggle(id: string) {
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleAddSelected() {
    const sel = contacts.filter((c) => picked.includes(c.id));
    onAdd(sel.map((c) => ({
      name: c.name, email: c.email, company: c.company, role: c.role, custom1: c.custom1, custom2: c.custom2,
    })));
    setPicked([]);
    setMsg(`Added ${sel.length} recipients.`);
    setTimeout(() => setMsg(""), 2000);
  }

  async function handleSaveCurrent() {
    if (!currentRecipients.length) return;
    setBusy(true); setMsg("");
    try {
      let saved = 0;
      for (const r of currentRecipients) {
        if (!r.email) continue;
        await fetch("/api/jobs/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: r.email,
            name: r.name || "",
            company: r.company || defaultCompany,
            role: r.role || defaultRole,
          }),
        });
        saved++;
      }
      setMsg(`Saved ${saved} contacts.`);
      setShowAddCurrent(false);
      setDefaultCompany(""); setDefaultRole("");
      refresh();
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); setTimeout(() => setMsg(""), 3000); }
  }

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Saved Contacts</span>
          <span className="text-[10px] text-slate-500">({contacts.length} saved)</span>
        </div>
        {currentRecipients.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddCurrent(true)}
            className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/20 inline-flex items-center gap-1"
          >
            <Save size={11} /> Save current ({currentRecipients.length})
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-xs text-slate-500">No saved contacts yet. Save your current recipients (button above) or add some.</p>
      ) : (
        <>
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input-field text-xs w-full pl-7"
              placeholder="Search saved contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-40 overflow-y-auto border border-slate-700/30 rounded-lg bg-slate-900/40">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 p-3">No matches.</p>
            ) : (
              filtered.map((c) => {
                const isPicked = picked.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-800/50 border-b border-slate-800/40 last:border-b-0 ${isPicked ? "bg-emerald-500/10" : ""}`}
                  >
                    <input type="checkbox" checked={isPicked} onChange={() => toggle(c.id)} />
                    <span className="flex-1 truncate">
                      <span className="text-slate-200">{c.name || c.email}</span>
                      <span className="text-slate-500"> — {c.email}</span>
                      {c.company && <span className="text-slate-500"> · {c.company}</span>}
                      {c.role && <span className="text-slate-500"> · {c.role}</span>}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {picked.length > 0 && (
            <button
              type="button"
              onClick={handleAddSelected}
              className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 inline-flex items-center gap-1.5"
            >
              <Plus size={12} /> Add {picked.length} to recipients
            </button>
          )}
        </>
      )}
      {msg && <p className="text-emerald-300 text-xs mt-2">{msg}</p>}

      {showAddCurrent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md space-y-3">
            <h3 className="text-white font-semibold">Save current recipients</h3>
            <p className="text-xs text-slate-400">Optional defaults applied to recipients that don&apos;t already have them:</p>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Default company</label>
              <input className="input-field text-sm w-full mt-1" value={defaultCompany} onChange={(e) => setDefaultCompany(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Default role</label>
              <input className="input-field text-sm w-full mt-1" placeholder="e.g. Python Backend Developer" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowAddCurrent(false)} className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={handleSaveCurrent} disabled={busy} className="btn-primary text-sm flex items-center gap-1.5">
                <Save size={14} /> {busy ? "Saving…" : "Save all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
