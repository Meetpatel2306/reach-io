import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Reach.io",
  description: "Send bulk emails with resume attachments",
  manifest: "/manifest.json",
  applicationName: "Reach.io",
  appleWebApp: {
    capable: true,
    title: "Reach.io",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
    shortcut: "/icon-192.svg",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* iOS-specific PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Reach.io" />
        <meta name="format-detection" content="telephone=no" />

        {/* Apple touch icons (multiple sizes for iOS home screen) */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon.svg" />

        {/* Mask icon for Safari pinned tabs */}
        <link rel="mask-icon" href="/icon-192.svg" color="#6366f1" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then((reg) => {
                    setInterval(() => reg.update(), 60000);
                    reg.addEventListener('updatefound', () => {
                      const newWorker = reg.installing;
                      if (!newWorker) return;
                      newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                          window.location.reload();
                        }
                      });
                    });
                  });
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
