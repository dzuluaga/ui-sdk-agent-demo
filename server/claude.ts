import Anthropic from "@anthropic-ai/sdk"
import type { Connect } from "vite"
import { tools } from "../src/tools.ts"

const system = `You operate the page in the user's browser, a sprint task list and a checkout, through the tools the page offers. Do what the user asks with as few calls as you can. When a step fails with "Needs a person" or "The person said no", say so plainly and stop; don't look for another way. When a change you asked for didn't take, say which and why if the page says. Reply in one or two short sentences.`

function claudeRoute(apiKey: string | undefined): Connect.NextHandleFunction {
  const client = new Anthropic(apiKey ? { apiKey } : {})

  return async (req, res, next) => {
    if (req.url !== "/api/claude" || req.method !== "POST") return next()
    let body = ""
    for await (const chunk of req) body += chunk
    // The page sends the tools it registered through WebMCP; without them,
    // Claude gets ui-sdk's three.
    const { messages, tools: pageTools } = JSON.parse(body) as {
      messages: Anthropic.Beta.BetaMessageParam[]
      tools?: Anthropic.Beta.BetaTool[]
    }

    res.setHeader("content-type", "application/json")
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools: pageTools?.length ? pageTools : tools,
        messages,
      })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.statusCode = error instanceof Anthropic.APIError ? (error.status ?? 500) : 500
      const message = error instanceof Error ? error.message : String(error)
      res.end(JSON.stringify({ error: message }))
    }
  }
}

export { claudeRoute }
