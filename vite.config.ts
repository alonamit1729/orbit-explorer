import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api/* to the locally-running FastAPI on port 8000.
// In production on Vercel, /api/* is served by api/index.py — no proxy needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
