import type Anthropic from "@anthropic-ai/sdk"
import { agentTools } from "@ui-sdk/react/agent"
import { Button } from "@ui-sdk/react/button"
import { Input } from "@ui-sdk/react/input"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { useRef, useState } from "react"
import { runTurn, type CallClaude, type Event } from "./claude-loop"
import { taskStore } from "./task-store"
import { modelContextToolbox, modelContextTools } from "./webmcp"

const uiSdkNames = new Set(agentTools.map((tool) => tool.name))

const toolSets = [
  {
    value: "ui-sdk",
    label: "ui-sdk",
    detail: "snapshot, act and query, generated from every component on the page.",
    has: (name: string) => uiSdkNames.has(name),
  },
  {
    value: "webmcp",
    label: "Hand-written",
    detail: "list_tasks, assign_task, set_status and delete_task, written for the task list only.",
    has: (name: string) => !uiSdkNames.has(name),
  },
  {
    value: "both",
    label: "Both",
    detail: "All seven tools; Claude picks.",
    has: () => true,
  },
]

const callClaudeWith =
  (tools: Anthropic.Beta.BetaTool[]): CallClaude =>
  async (messages) => {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, tools }),
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
  if (name !== "act") {
    const args = Object.values(input ?? {}).map((a) => JSON.stringify(a))
    return `${name}(${args.join(", ")})`
  }
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
  let parsed: any = output
  try {
    parsed = JSON.parse(output)
  } catch {}
  if (name === "snapshot" && Array.isArray(parsed)) return `${parsed.length} components on the page`
  if (name === "list_tasks" && Array.isArray(parsed)) return `${parsed.length} tasks`
  if (isError) return `✗ ${parsed?.error?.message ?? parsed?.error ?? output}`
  return output.length > 120 ? "✓ done" : `✓ ${output}`
}

function describe(event: Event, page: Entry[]): Line {
  if (event.kind === "text") return { who: "claude", text: event.text }
  if (event.kind === "refusal")
    return { who: "error", text: `Claude declined (${event.category ?? "no category"})` }
  if (event.kind === "call") return { who: "tool", text: describeCall(event.name, event.input, page) }
  return { who: "tool", text: describeResult(event.name, event.output, event.isError) }
}

function Chat({ nativeWebMCP }: { nativeWebMCP: boolean }) {
  const messages = useRef<Anthropic.Beta.BetaMessageParam[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [toolSet, setToolSet] = useState("ui-sdk")

  async function send(text: string) {
    setBusy(true)
    setLines((prev) => [...prev, { who: "you", text }])
    messages.current.push({ role: "user", content: text })
    const tools = modelContextTools(toolSets.find((set) => set.value === toolSet)!.has)
    try {
      let page: Entry[] = []
      await runTurn(messages.current, callClaudeWith(tools), modelContextToolbox, (event) => {
        if (event.kind === "tool" && event.name === "snapshot" && !event.isError)
          page = JSON.parse(event.output)
        setLines((prev) => [...prev, describe(event, page)])
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setLines((prev) => [...prev, { who: "error", text }])
    }
    setBusy(false)
  }

  function reset() {
    messages.current = []
    setLines([])
    taskStore.reset()
  }

  return (
    <section data-agent-hidden aria-label="Chat with Claude" className="chat">
      <header>
        <h2>Ask Claude</h2>
        <Button className="start-over" onClick={reset} disabled={busy || lines.length === 0}>
          Start over
        </Button>
      </header>
      <p className="product">
        Claude uses the tools this page registered through WebMCP
        {nativeWebMCP ? ", passed on to the browser's own" : ""}.
      </p>
      <div className="tool-set">
        <span id="tool-set-label">Claude's tools</span>
        <SegmentedControl
          aria-labelledby="tool-set-label"
          value={toolSet}
          disabled={busy}
          onValueChange={(value) => value && setToolSet(value)}
        >
          {toolSets.map((set) => (
            <SegmentedControlItem key={set.value} value={set.value}>
              {set.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <p>{toolSets.find((set) => set.value === toolSet)!.detail}</p>
      </div>
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
          placeholder="Assign the login bug to Jane…"
        />
        <Button type="submit" data-variant="solid" disabled={busy}>
          {busy ? "Working…" : "Send"}
        </Button>
      </form>
    </section>
  )
}

export { Chat }
