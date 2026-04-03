import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    host: "0.0.0.0",
    port: 1430,
    strictPort: true,
  },
  preview: {
    port: 1430,
    strictPort: true,
  },
  build: {
    target: "esnext",
  },
});
