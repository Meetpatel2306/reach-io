"use client";

// Lean inline template loader for the email-compose step.
// Heavy CRUD (create/edit/delete/duplicate) lives on /templates so this
// stays one dropdown + one "Manage" link — fast to scan on mobile.

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import type { Template } from "@/lib/jobAppShared";

export interface TemplateLoadPayload {
  subject: string;
  body: string;
  // If the template has a baked-in resume, these come through too — the
  // compose page can choose to auto-attach it.
  resumeName?: string;
  resumeBase64?: string;
  resumeSize?: number;
}

interface Props {
  subject: string;
  body: string;
  onLoad: (payload: TemplateLoadPayload) => void;
}

export function TemplatePicker({ onLoad }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picked, setPicked] = useState("");

  const refresh = async () => {
    try {
      const r = await fetch("/api/jobs/templates", { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data.templates)) setTemplates(data.templates);
    } catch {}
  };
  useEffect(() => { refresh(); }, []);

  function handlePick(id: string) {
    setPicked(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (t) {
      onLoad({
        subject: t.subject,
        body: t.body,
        resumeName: t.resumeName,
        resumeBase64: t.resumeBase64,
        resumeSize: t.resumeSize,
      });
    }
  }

  return (
    <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 sm:p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-violet-400" />
          <span className="text-sm font-semibold text-violet-300 uppercase tracking-wider">Load Template</span>
        </div>
        <Link
          href="/templates"
          className="text-xs text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
        >
          Manage templates <ExternalLink size={12} />
        </Link>
      </div>

      <select
        className="input-field w-full text-base sm:text-sm py-3 sm:py-2"
        value={picked}
        onChange={(e) => handlePick(e.target.value)}
      >
        <option value="">— Pick a saved template to load —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.roleType ? ` (${t.roleType})` : ""}
          </option>
        ))}
      </select>

      {templates.length === 0 && (
        <p className="text-xs text-slate-500 mt-2">
          No templates yet. <Link href="/templates" className="text-violet-300 hover:text-violet-200 underline">Create one →</Link>
        </p>
      )}
    </div>
  );
}
