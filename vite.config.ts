import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

const proxyRoutes = ["/records", "/albums", "/auth"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL ?? "http://api.moctezumarecords.com";

  const proxy = proxyRoutes.reduce<
    Record<string, { target: string; changeOrigin: boolean; secure: boolean }>
  >((acc, route) => {
    acc[route] = {
      target: apiTarget,
      changeOrigin: true,
      secure: false
    };
    return acc;
  }, {});

  return {
    plugins: [react()],
    server: {
      proxy
    }
  };
});
