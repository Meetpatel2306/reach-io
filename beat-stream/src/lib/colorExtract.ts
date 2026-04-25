const cache = new Map<string, string>();

export async function extractDominantColor(imgUrl: string): Promise<string> {
  if (cache.has(imgUrl)) return cache.get(imgUrl)!;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("#1f1f1f");
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (!n) return resolve("#1f1f1f");
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        // Darken to make a good background
        const f = 0.55;
        r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
        const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
        cache.set(imgUrl, hex);
        resolve(hex);
      } catch {
        resolve("#1f1f1f");
      }
    };
    img.onerror = () => resolve("#1f1f1f");
    img.src = imgUrl;
  });
}
