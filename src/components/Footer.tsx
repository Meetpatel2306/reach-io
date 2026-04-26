import { BUNDLED_VERSION } from "@/lib/updater";

export function Footer() {
  return (
    <footer className="mt-12 pb-6 px-4 flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[11px] text-slate-600 select-none">
      <span className="font-semibold text-slate-500">MailFlare</span>
      <span className="hidden sm:inline">·</span>
      <span className="font-mono text-violet-400/60">{BUNDLED_VERSION}</span>
      <span className="hidden sm:inline">·</span>
      <span>Made with care by <span className="text-slate-400 font-medium">Meet Patel</span></span>
    </footer>
  );
}
