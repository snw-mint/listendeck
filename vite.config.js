import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    minify: true,
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        charts: resolve(__dirname, "charts/index.html"),
        chartsResult: resolve(__dirname, "charts/result.html"),
        match: resolve(__dirname, "match/index.html"),
        matchResult: resolve(__dirname, "match/result.html"),
        lyrics: resolve(__dirname, "lyrics/index.html"),
        lyricsResult: resolve(__dirname, "lyrics/result.html"),
        cards: resolve(__dirname, "cards/index.html"),
        cardsResult: resolve(__dirname, "cards/result.html"),
        privacy: resolve(__dirname, "privacy.html"),
        terms: resolve(__dirname, "terms.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deezer/, ""),
      },
    },
    port: 5173,
    strictPort: true,
  },
});
