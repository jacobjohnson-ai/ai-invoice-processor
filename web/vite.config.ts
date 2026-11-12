import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://jacobjohnson-ai.github.io/ai-invoice-processor/
export default defineConfig({ base: "/ai-invoice-processor/", plugins: [react()] });
