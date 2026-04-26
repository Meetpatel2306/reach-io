"use client";
import { useEffect, useState } from "react";
import { X, Copy, Download } from "lucide-react";
import { qrSvg } from "@/lib/qrcode";
import { useToast } from "@/contexts/ToastContext";

export function QRModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [svg, setSvg] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setSvg(qrSvg(url, { fg: "#0a0a0a", bg: "#ffffff", size: 320, padding: 4 }));
  }, [url]);

  function copy() {
    navigator.clipboard.writeText(url);
    toast("Link copied", "success");
  }

  function download() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${title.replace(/[^\w\s-]/g, "").trim()}-qr.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Share via QR</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-white p-3 rounded-xl inline-block mb-4" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-sm text-secondary line-clamp-2 mb-4">{title}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={copy} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm flex items-center gap-2"><Copy className="w-4 h-4" /> Copy link</button>
          <button onClick={download} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Download</button>
        </div>
      </div>
    </div>
  );
}
