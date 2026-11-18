import type Anthropic from "@anthropic-ai/sdk"
import type { createAgent } from "@ui-sdk/react/agent"
import { useRef, useState } from "react"
import { runTurn, type CallClaude, type Event } from "./claude-loop"

const callClaude: CallClaude = async (messages) => {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error)
  return body
}

type Line = { who: "you" | "claude" | "tool" | "error"; text: string }

function describe(event: Event): Line {
  if (event.kind === "text") return { who: "claude", text: event.text }
  if (event.kind === "refusal")
    return { who: "error", text: `Claude declined (${event.category ?? "no category"})` }
  const output = event.output.length > 300 ? `${event.output.slice(0, 300)}…` : event.output
  return {
    who: "tool",
    text: `${event.name}(${JSON.stringify(event.input)})${event.isError ? " ✗" : ""} → ${output}`,
  }
}

function Chat({ agent }: { agent: ReturnType<typeof createAgent> }) {
  const messages = useRef<Anthropic.Beta.BetaMessageParam[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)

  async function send(text: string) {
    setBusy(true)
    setLines((prev) => [...prev, { who: "you", text }])
    messages.current.push({ role: "user", content: text })
    try {
      await runTurn(messages.current, callClaude, agent, (event) =>
        setLines((prev) => [...prev, describe(event)])
      )
    } catch (error) {
      setLines((prev) => [...prev, { who: "error", text: String(error) }])
    }
    setBusy(false)
  }

  return (
    <section data-agent-hidden aria-label="Chat with Claude" className="chat">
      <h2>Ask Claude</h2>
      <ol>
        {lines.map((line, i) => (
          <li key={i} data-who={line.who}>
            <b>{line.who}:</b> {line.text}
          </li>
        ))}
      </ol>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const input = event.currentTarget.elements.namedItem("prompt") as HTMLInputElement
          if (input.value.trim()) send(input.value.trim())
          input.value = ""
        }}
      >
        <input name="prompt" aria-label="Message" disabled={busy} placeholder="Check out with express shipping and gift wrap, email me@example.com, card 4242424242424242" />
        <button disabled={busy}>{busy ? "Working…" : "Send"}</button>
      </form>
    </section>
  )
}

export { Chat }
