import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Read version.json at build time so the bundle knows its own version
let bundleVersion = "dev";
let bundleBuildTime = new Date().toISOString();
let bundleRelease = "1.0.0";
try {
  const versionPath = path.join(process.cwd(), "public", "version.json");
  const data = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
  bundleVersion = data.version || "dev";
  bundleBuildTime = data.buildTime || bundleBuildTime;
  bundleRelease = data.release || "1.0.0";
} catch {}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: bundleVersion,
    NEXT_PUBLIC_APP_BUILD_TIME: bundleBuildTime,
    NEXT_PUBLIC_APP_RELEASE: bundleRelease,
  },
  async headers() {
    return [
      {
        source: "/version.json",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
