import type Anthropic from "@anthropic-ai/sdk"
import type { createAgent } from "@ui-sdk/react/agent"

type Agent = ReturnType<typeof createAgent>
type CallClaude = (
  messages: Anthropic.Beta.BetaMessageParam[]
) => Promise<Anthropic.Beta.BetaMessage>
type Event =
  | { kind: "call"; name: string; input: unknown }
  | { kind: "tool"; name: string; input: unknown; output: string; isError: boolean }
  | { kind: "text"; text: string }
  | { kind: "refusal"; category: string | null }
// Runs one tool call: ui-sdk's bridge directly, or whatever the page
// registered through WebMCP.
type Toolbox = { run: (name: string, input: any) => Promise<{ output: unknown; isError: boolean }> }

const agentToolbox = (agent: Agent): Toolbox => ({
  async run(name, input) {
    if (name === "snapshot") return { output: agent.snapshot(), isError: false }
    if (name === "act") {
      const result = await agent.act(input)
      return { output: result, isError: !result.ok }
    }
    if (name === "query") {
      const result = await agent.query(input)
      return { output: result, isError: "error" in result }
    }
    return { output: `Unknown tool ${name}`, isError: true }
  },
})

async function runTurn(
  messages: Anthropic.Beta.BetaMessageParam[],
  callClaude: CallClaude,
  toolbox: Toolbox,
  onEvent: (event: Event) => void
) {
  for (;;) {
    const response = await callClaude(messages)
    messages.push({ role: "assistant", content: response.content })

    for (const block of response.content) {
      if (block.type === "text" && block.text) onEvent({ kind: "text", text: block.text })
    }
    if (response.stop_reason === "refusal") {
      onEvent({ kind: "refusal", category: response.stop_details?.category ?? null })
      return
    }
    if (response.stop_reason !== "tool_use") return

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== "tool_use") continue
      onEvent({ kind: "call", name: block.name, input: block.input })
      const { output, isError } = await toolbox.run(block.name, block.input)
      const text = typeof output === "string" ? output : JSON.stringify(output)
      onEvent({ kind: "tool", name: block.name, input: block.input, output: text, isError })
      results.push({ type: "tool_result", tool_use_id: block.id, content: text, is_error: isError })
    }
    messages.push({ role: "user", content: results })
  }
}

export { agentToolbox, runTurn }
export type { CallClaude, Event, Toolbox }
