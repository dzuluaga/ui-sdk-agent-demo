import type Anthropic from "@anthropic-ai/sdk"
import type { createAgent } from "@ui-sdk/react/agent"
import { Button } from "@ui-sdk/react/button"
import { Input } from "@ui-sdk/react/input"
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

type Step = { ref: string; action: string; args?: unknown[] }
type Entry = { ref: string; label?: string; items?: { value: string; label: string }[] }

// Claude may name a component by its ref ("c1") and an item by its value ("jane");
// show both by their labels from the last snapshot so the log reads like the page.
function describeCall(name: string, input: any, page: Entry[]) {
  if (name !== "act") return `${name}()`
  const steps = (input?.steps ?? []) as Step[]
  return steps
    .map((s) => {
      const entry = page.find((e) => e.ref === s.ref)
      const args = (s.args ?? []).map((a) => {
        const item = entry?.items?.find((i) => i.value === a)
        return JSON.stringify(item?.label ?? a)
      })
      return `${s.action}(${args.join(", ")}) on “${entry?.label ?? s.ref}”`
    })
    .join("\n")
}

function describeResult(name: string, output: string, isError: boolean) {
  const parsed = JSON.parse(output)
  if (name === "snapshot" && Array.isArray(parsed)) return `${parsed.length} components on the page`
  if (isError) return `✗ ${parsed.error?.message ?? output}`
  return output.length > 120 ? "✓ done" : `✓ ${output}`
}

function describe(event: Event, page: Entry[]): Line {
  if (event.kind === "text") return { who: "claude", text: event.text }
  if (event.kind === "refusal")
    return { who: "error", text: `Claude declined (${event.category ?? "no category"})` }
  if (event.kind === "call") return { who: "tool", text: describeCall(event.name, event.input, page) }
  return { who: "tool", text: describeResult(event.name, event.output, event.isError) }
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
      let page: Entry[] = []
      await runTurn(messages.current, callClaude, agent, (event) => {
        if (event.kind === "tool" && event.name === "snapshot" && !event.isError)
          page = JSON.parse(event.output)
        const line = describe(event, page)
        setLines((prev) => [...prev, line])
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setLines((prev) => [...prev, { who: "error", text }])
    }
    setBusy(false)
  }

  return (
    <section data-agent-hidden aria-label="Chat with Claude" className="chat">
      <h2>Ask Claude</h2>
      <p className="product">Claude works the tasks and the checkout through ui-sdk's agent tools.</p>
      <ol>
        {lines.map((line, i) => (
          <li key={i} data-who={line.who}>
            {line.who === "tool" ? `↳ ${line.text}` : line.text}
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
        <Input
          name="prompt"
          aria-label="Message"
          disabled={busy}
          placeholder="Check out with express shipping and gift wrap…"
        />
        <Button type="submit" data-variant="solid" disabled={busy}>
          {busy ? "Working…" : "Send"}
        </Button>
      </form>
    </section>
  )
}

export { Chat }
