import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["storage", "tabs"],
    host_permissions: ["http://127.0.0.1/*", "http://localhost/*"],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' ws://127.0.0.1:57821 http://127.0.0.1:57821 ws://localhost:57821 http://localhost:57821",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
