import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { target: "es2022", sourcemap: true },
  server: {
    strictPort: true,
    port: Number(process.env.PACKETHALO_WEB_PORT || 5173),
  },
  preview: {
    host: "127.0.0.1",
    port: Number(process.env.PACKETHALO_WEB_PREVIEW_PORT || 4173),
  },
});
