import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    strictPort: true,
    port: Number(process.env.PACKETHALO_CONTROL_PORT || 5174),
  },
  preview: {
    host: "127.0.0.1",
    port: Number(process.env.PACKETHALO_CONTROL_PREVIEW_PORT || 4174),
  },
  build: { target: "es2022" },
});
