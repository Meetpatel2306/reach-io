import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "BeatStream — Free Music Streaming",
  description: "Free music streaming — play any song",
  manifest: "/manifest.json",
  applicationName: "BeatStream",
  appleWebApp: {
    capable: true,
    title: "BeatStream",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192.svg",
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-accent="green">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BeatStream" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then((reg) => {
                    setInterval(() => reg.update(), 60000);
                    reg.addEventListener('updatefound', () => {
                      const w = reg.installing;
                      if (!w) return;
                      w.addEventListener('statechange', () => {
                        if (w.state === 'activated' && navigator.serviceWorker.controller) {
                          window.location.reload();
                        }
                      });
                    });
                  });
                  navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload();
                  });
                });
                if (navigator.storage && navigator.storage.persist) {
                  navigator.storage.persist().catch(()=>{});
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
