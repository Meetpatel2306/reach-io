"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, MessageSquare, Loader2, Send, Bug, HelpCircle, Lightbulb,
  MoreHorizontal, ChevronDown, ChevronUp, AlertCircle, Check, Crown, User as UserIcon, Plus
} from "lucide-react";

interface TicketReply {
  from: "user" | "admin";
  fromName: string;
  message: string;
  timestamp: string;
}

interface Ticket {
  id: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  priority: "low" | "normal" | "high";
  category: "bug" | "question" | "feature" | "other";
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}

const CATEGORIES = [
  { id: "question", label: "Question", icon: HelpCircle, color: "from-violet-500 to-indigo-500" },
  { id: "bug", label: "Bug", icon: Bug, color: "from-red-500 to-pink-500" },
  { id: "feature", label: "Feature", icon: Lightbulb, color: "from-amber-500 to-orange-500" },
  { id: "other", label: "Other", icon: MoreHorizontal, color: "from-slate-500 to-slate-400" },
] as const;

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New ticket form
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["id"]>("question");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [submitting, setSubmitting] = useState(false);

  // Reply
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support/tickets");
      const data = await res.json();
      if (data.tickets) setTickets(data.tickets);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category, priority }),
      });
      if (res.ok) {
        setSubject("");
        setMessage("");
        setCategory("question");
        setPriority("normal");
        setShowCreate(false);
        await loadTickets();
      }
    } catch {}
    setSubmitting(false);
  };

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message: replyText }),
      });
      if (res.ok) {
        setReplyText("");
        setReplyingTo(null);
        await loadTickets();
      }
    } catch {}
    setSendingReply(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <MessageSquare size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Help & Support</h1>
              <p className="text-xs text-slate-500">Get help from the admin team</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus size={14} />New Ticket
        </button>
      </div>

      {/* Create new ticket */}
      {showCreate && (
        <form onSubmit={handleCreate} className="glass-card !border-violet-500/20 mb-6 space-y-4">
          <h2 className="text-base font-bold text-white">Open a new ticket</h2>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 block">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border transition-all ${
                      category === c.id
                        ? `bg-gradient-to-br ${c.color} text-white border-transparent shadow-lg`
                        : "bg-slate-800/40 text-slate-400 border-slate-700/40 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px] font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-2 block">Priority</label>
            <div className="flex gap-2">
              {(["low", "normal", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${
                    priority === p
                      ? p === "high" ? "bg-red-500/20 text-red-300 border-red-500/40"
                        : p === "low" ? "bg-slate-800/50 text-slate-300 border-slate-600"
                        : "bg-violet-500/20 text-violet-300 border-violet-500/40"
                      : "bg-slate-800/40 text-slate-400 border-slate-700/40"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description..."
              className="input-field"
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Message</label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question in detail..."
              className="input-field"
            />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-sm">Cancel</button>
            <button type="submit" disabled={submitting || !subject.trim() || !message.trim()} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? "Submitting..." : "Submit ticket"}
            </button>
          </div>
        </form>
      )}

      {/* Tickets list */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={28} className="animate-spin text-violet-400 mx-auto" />
        </div>
      ) : tickets.length === 0 && !showCreate ? (
        <div className="glass-card text-center py-12">
          <MessageSquare size={48} className="text-slate-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-400 mb-1">No tickets yet</h2>
          <p className="text-sm text-slate-600 mb-6">Got a question or issue? Open a ticket and we&apos;ll help.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />Open your first ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const isExpanded = expandedId === t.id;
            const cat = CATEGORIES.find((c) => c.id === t.category) || CATEGORIES[0];
            const Icon = cat.icon;
            const hasAdminReply = t.replies.some((r) => r.from === "admin");

            return (
              <div key={t.id} className={`glass-card !p-0 overflow-hidden ${t.status === "resolved" ? "opacity-75" : ""}`}>
                <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shrink-0 shadow-md`}>
                    <Icon size={18} className="text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white truncate">{t.subject}</p>
                      {t.status === "resolved" && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={9} />Resolved
                        </span>
                      )}
                      {t.status === "open" && hasAdminReply && (
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                          Reply received
                        </span>
                      )}
                      {t.priority === "high" && (
                        <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                          High
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="capitalize">{cat.label}</span>
                      <span>•</span>
                      <span>{t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}</span>
                      <span>•</span>
                      <span>{timeAgo(t.updatedAt)}</span>
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800/50 p-4 space-y-3 bg-slate-900/20">
                    {/* Original message */}
                    <Message
                      from="user"
                      fromName={t.userName || "You"}
                      message={t.message}
                      timestamp={t.createdAt}
                    />

                    {/* Replies */}
                    {t.replies.map((r, i) => (
                      <Message key={i} {...r} />
                    ))}

                    {/* Reply form */}
                    {t.status === "open" && (
                      <div>
                        {replyingTo === t.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Type your reply..."
                              className="input-field !text-xs"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button onClick={() => { setReplyingTo(null); setReplyText(""); }} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs">Cancel</button>
                              <button onClick={() => handleReply(t.id)} disabled={sendingReply || !replyText.trim()} className="btn-primary flex-1 !py-1.5 !text-xs flex items-center justify-center gap-1">
                                {sendingReply ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                Reply
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setReplyingTo(t.id); setReplyText(""); }} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/30 text-xs hover:bg-violet-500/20">
                            <MessageSquare size={12} />Add reply
                          </button>
                        )}
                      </div>
                    )}

                    {t.status === "resolved" && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                        <Check size={14} className="text-emerald-400" />
                        <p className="text-xs text-emerald-300">This ticket has been marked as resolved.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Message({ from, fromName, message, timestamp }: { from: "user" | "admin"; fromName: string; message: string; timestamp: string }) {
  const isAdmin = from === "admin";
  return (
    <div className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isAdmin
          ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-500/20"
          : "bg-gradient-to-br from-violet-500 to-indigo-500"
      }`}>
        {isAdmin ? <Crown size={14} className="text-white" /> : <UserIcon size={14} className="text-white" />}
      </div>
      <div className={`flex-1 min-w-0 max-w-[80%] ${isAdmin ? "text-right" : ""}`}>
        <div className={`flex items-center gap-2 mb-1 ${isAdmin ? "justify-end" : ""}`}>
          <span className={`text-[11px] font-semibold ${isAdmin ? "text-amber-300" : "text-violet-300"}`}>{fromName}</span>
          {isAdmin && <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">Admin</span>}
          <span className="text-[10px] text-slate-600">{timeAgo(timestamp)}</span>
        </div>
        <div className={`inline-block rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap text-left ${
          isAdmin
            ? "bg-amber-500/10 border border-amber-500/20 text-slate-200 rounded-tr-none"
            : "bg-slate-800/50 border border-slate-700/30 text-slate-200 rounded-tl-none"
        }`}>
          {message}
        </div>
      </div>
    </div>
  );
}
