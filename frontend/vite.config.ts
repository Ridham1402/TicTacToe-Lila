import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // Proxy Nakama API in local dev to avoid CORS issues when using HTTP (not WS)
        proxy: {},
    },
    build: {
        outDir: "dist",
        sourcemap: true,
    },
});
