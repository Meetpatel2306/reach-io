import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email Blaster Pro",
  description: "Send bulk emails with resume attachments",
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then((reg) => {
                    // Check for updates every 60 seconds
                    setInterval(() => reg.update(), 60000);

                    reg.addEventListener('updatefound', () => {
                      const newWorker = reg.installing;
                      if (!newWorker) return;
                      newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                          // New version available — reload to get latest
                          window.location.reload();
                        }
                      });
                    });
                  });

                  // When a new SW takes over, reload
                  navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload();
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
