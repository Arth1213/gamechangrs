import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cricketApiProxyTarget = env.CRICKET_API_PROXY_TARGET || "http://127.0.0.1:4011";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/cricket-api": {
          target: cricketApiProxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/cricket-api/, ""),
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
