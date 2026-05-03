"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Save, Trash2, X, Upload, Search } from "lucide-react";
import { fetchContacts, importContactsCsv, removeContact, saveContact, updateContact } from "../_lib/client";
import type { Contact } from "@/lib/jobAppShared";

const EMPTY: Partial<Contact> = { email: "", name: "", company: "", role: "", custom1: "", custom2: "", notes: "" };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const csvRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try { setContacts(await fetchContacts()); } catch (e) { setError(String(e)); }
  };
  useEffect(() => { refresh(); }, []);

  async function handleSave() {
    if (!editing?.email || !editing.company || !editing.role) {
      setError("Email, company, and role are required.");
      return;
    }
    setBusy(true); setError("");
    try {
      if (editing.id) await updateContact(editing.id, editing);
      else await saveContact(editing);
      setEditing(null);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact?")) return;
    await removeContact(id);
    refresh();
  }

  async function handleCsvImport(file: File) {
    setBusy(true); setError("");
    try {
      const result = await importContactsCsv(file);
      alert(`Imported ${result.imported} contacts.`);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); if (csvRef.current) csvRef.current.value = ""; }
  }

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return [c.email, c.name, c.company, c.role].some((f) => f.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Contacts</h2>
          <p className="text-sm text-slate-400">Save recipients once. Bulk-send later by selecting them in the Send tab.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => csvRef.current?.click()} className="inline-flex items-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-md text-sm">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <input
            ref={csvRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvImport(e.target.files[0])}
          />
          <button onClick={() => setEditing(EMPTY)} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium">
            <Plus className="w-4 h-4" /> New contact
          </button>
        </div>
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full bg-slate-900/60 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-1 focus:outline-indigo-500"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">No contacts.</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                <td className="p-3 text-slate-200">{c.email}</td>
                <td className="p-3 text-slate-300">{c.name || "—"}</td>
                <td className="p-3 text-slate-300">{c.company || "—"}</td>
                <td className="p-3 text-slate-300">{c.role || "—"}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => setEditing(c)} className="text-indigo-300 hover:text-indigo-200 text-xs">Edit</button>
                  <button onClick={() => handleDelete(c.id)} className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">CSV format</summary>
        <pre className="mt-2 bg-slate-900/60 p-3 rounded text-slate-400">{`email,name,company,role,custom1,custom2,notes
hr@acme.com,Priya Sharma,Acme,Python Backend Developer,,,
careers@beta.in,,Beta,AI/ML Developer,,,`}</pre>
      </details>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-medium">{editing.id ? "Edit contact" : "New contact"}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email *"><input className="input" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
                <Field label="Name"><input className="input" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <Field label="Company *"><input className="input" value={editing.company || ""} onChange={(e) => setEditing({ ...editing, company: e.target.value })} /></Field>
                <Field label="Role *"><input className="input" value={editing.role || ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></Field>
                <Field label="custom1"><input className="input" value={editing.custom1 || ""} onChange={(e) => setEditing({ ...editing, custom1: e.target.value })} /></Field>
                <Field label="custom2"><input className="input" value={editing.custom2 || ""} onChange={(e) => setEditing({ ...editing, custom2: e.target.value })} /></Field>
              </div>
              <Field label="Notes"><textarea className="input min-h-[80px]" value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                <button onClick={handleSave} disabled={busy} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                  <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgb(15 23 42 / 0.6);
          border: 1px solid rgb(30 41 59);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          color: rgb(241 245 249);
          font-size: 0.875rem;
        }
        :global(.input:focus) { outline: 1px solid rgb(99 102 241); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
