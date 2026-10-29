import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { PROXIED_IMAGE_HOSTS } from "./src/app/lib/image";

// Dev counterpart of the /ext-img rewrites in vercel.json: third-party
// images served from our origin (see src/app/lib/image.ts).
const imageProxy = Object.fromEntries(
  PROXIED_IMAGE_HOSTS.map((host) => [
    `/ext-img/${host}`,
    { target: `https://${host}`, changeOrigin: true, rewrite: (path: string) => path.slice(`/ext-img/${host}`.length) }
  ])
);

export default defineConfig({
  plugins: [react()],
  server: { proxy: imageProxy },
  preview: { proxy: imageProxy }
});
