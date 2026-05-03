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
    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-start sm:items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">Saved Contacts</span>
          <span className="text-[11px] text-slate-500">({contacts.length})</span>
        </div>
        {currentRecipients.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddCurrent(true)}
            className="px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm hover:bg-emerald-500/20 inline-flex items-center gap-1.5 active:scale-[0.98] transition"
          >
            <Save size={14} /> Save current ({currentRecipients.length})
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-slate-500">No saved contacts yet. Save your current recipients (button above) or add some.</p>
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input-field text-base sm:text-sm w-full pl-9 py-3 sm:py-2"
              placeholder="Search saved contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-64 sm:max-h-48 overflow-y-auto border border-slate-700/30 rounded-lg bg-slate-900/40">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No matches.</p>
            ) : (
              filtered.map((c) => {
                const isPicked = picked.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 px-3 py-3 sm:py-2 text-sm cursor-pointer hover:bg-slate-800/50 border-b border-slate-800/40 last:border-b-0 ${isPicked ? "bg-emerald-500/10" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => toggle(c.id)}
                      className="mt-1 w-4 h-4 shrink-0 accent-emerald-400"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-slate-200 truncate">{c.name || c.email}</span>
                      <span className="block text-xs text-slate-500 truncate">
                        {c.email}
                        {c.company && <> · {c.company}</>}
                        {c.role && <> · {c.role}</>}
                      </span>
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
              className="mt-3 w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            >
              <Plus size={16} /> Add {picked.length} to recipients
            </button>
          )}
        </>
      )}
      {msg && <p className="text-emerald-300 text-sm mt-2">{msg}</p>}

      {showAddCurrent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-white font-semibold text-lg">Save current recipients</h3>
            <p className="text-sm text-slate-400">Optional defaults applied to recipients that don&apos;t already have them:</p>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Default company</label>
              <input className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2" value={defaultCompany} onChange={(e) => setDefaultCompany(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Default role</label>
              <input className="input-field text-base sm:text-sm w-full mt-1 py-3 sm:py-2" placeholder="e.g. Python Backend Developer" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
              <button onClick={() => setShowAddCurrent(false)} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 sm:border-0 rounded-lg sm:rounded">Cancel</button>
              <button onClick={handleSaveCurrent} disabled={busy} className="w-full sm:w-auto btn-primary py-3 sm:py-2 text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
                <Save size={16} /> {busy ? "Saving…" : "Save all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
