import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,        // needed in Docker
    port: 5173,
    watch: { usePolling: true }, // helps file watching on Mac/Windows Docker
    proxy: {
      "/api": process.env.API_URL ?? "http://localhost:3000",
    },
  },
});
