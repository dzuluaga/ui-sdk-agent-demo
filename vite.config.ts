import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { claudeRoute } from "./server/claude.ts"

const claude = (apiKey: string | undefined): Plugin => ({
  name: "claude-route",
  configureServer(server) {
    server.middlewares.use(claudeRoute(apiKey))
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "ANTHROPIC_")
  return { plugins: [react(), claude(env.ANTHROPIC_API_KEY)] }
})
