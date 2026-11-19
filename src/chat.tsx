import type Anthropic from "@anthropic-ai/sdk"
import { agentTools, type createAgent } from "@ui-sdk/react/agent"
import { Button } from "@ui-sdk/react/button"
import { Input } from "@ui-sdk/react/input"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { useRef, useState } from "react"
import { agentToolbox, runTurn, type CallClaude, type Toolbox } from "./claude-loop"
import { taskStore } from "./task-store"
import { directToolbox, modelContextToolbox, modelContextTools } from "./webmcp"

const uiSdkNames = new Set(agentTools.map((tool) => tool.name))

const toolSets = [
  {
    value: "ui-sdk",
    label: "ui-sdk (generic)",
    short: "ui-sdk tools",
    detail:
      "3 generic tools: snapshot, query, act. ui-sdk makes them from the components on the page; the app's developer writes no tool code. They cover the checkout too.",
    has: (name: string) => uiSdkNames.has(name),
  },
  {
    value: "custom",
    label: "App-specific",
    short: "app-specific tools",
    detail:
      "4 tools the app's developer coded for the task list: list_tasks, assign_task, set_status, delete_task. Each runs the developer's own function on the app's data. They don't cover the checkout.",
    has: (name: string) => !uiSdkNames.has(name),
  },
  { value: "both", label: "Both", short: "all 7 tools", detail: "All 7. Claude picks.", has: () => true },
]

const routes = [
  {
    value: "webmcp",
    label: "Via WebMCP",
    detail:
      "The page registers the tools with Chrome's WebMCP, a new browser standard that lets other agents in the browser find them too, and passes each of Claude's calls to Chrome's executeTool. Watch them in DevTools › Application › WebMCP › Tool Activity.",
  },
  {
    value: "direct",
    label: "Direct",
    detail: "The page calls the tool function itself, without Chrome. Same result on screen; Tool Activity stays empty.",
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

// "asked" is Claude's tool call exactly as it sent it (JSON); "ran" is the
// page's code running it, named by whose code it is.
type Line = { who: "you" | "mode" | "claude" | "asked" | "ran" | "error"; text: string; tag?: string }

type Step = { ref: string; action: string; args?: unknown[] }
type Entry = { ref: string; label?: string; items?: { value: string; label: string }[] }

// Claude may name a component by its ref ("c1") and an item by its value ("jane");
// show both by their labels from the last snapshot so the log reads like the page.
function describeSteps(input: any, page: Entry[]) {
  return ((input?.steps ?? []) as Step[])
    .map((s) => {
      const entry = page.find((e) => e.ref === s.ref)
      const args = (s.args ?? []).map((a) => {
        const item = entry?.items?.find((i) => i.value === a)
        return JSON.stringify(item?.label ?? a)
      })
      return `${s.action}${args.length ? " " + args.join(", ") : ""} on “${entry?.label ?? s.ref}”`
    })
    .join("; ")
}

function describeResult(name: string, output: string, isError: boolean) {
  let parsed: any = output
  try {
    parsed = JSON.parse(output)
  } catch {}
  if (isError) return `✗ ${parsed?.error?.message ?? parsed?.error ?? output}`
  if (name === "snapshot" && Array.isArray(parsed)) return `${parsed.length} components`
  if (name === "query" && Array.isArray(parsed)) return `${parsed.length} matching components`
  if (name === "list_tasks" && Array.isArray(parsed)) return `${parsed.length} tasks`
  return output.length > 120 ? "✓" : `✓ ${output}`
}

function describeRun(name: string, input: any, output: string, isError: boolean, page: Entry[]) {
  const whose = uiSdkNames.has(name) ? `ui-sdk's ${name}` : `the app's ${name}()`
  const what = name === "act" ? ` ${describeSteps(input, page)}` : ""
  return `${whose}${what} → ${describeResult(name, output, isError)}`
}

type Agent = ReturnType<typeof createAgent>

function Chat({ agent, nativeWebMCP }: { agent: Agent; nativeWebMCP: boolean }) {
  const messages = useRef<Anthropic.Beta.BetaMessageParam[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [toolSet, setToolSet] = useState("ui-sdk")
  const [route, setRoute] = useState("webmcp")

  function toolbox(): Toolbox {
    if (route === "webmcp") return modelContextToolbox
    const uiSdk = agentToolbox(agent)
    return { run: (name, input) => (uiSdkNames.has(name) ? uiSdk : directToolbox).run(name, input) }
  }

  async function send(text: string) {
    setBusy(true)
    const set = toolSets.find((s) => s.value === toolSet)!
    const tag = route === "webmcp" ? "via WebMCP" : "direct"
    setLines((prev) => [...prev, { who: "you", text }, { who: "mode", text: `${set.short} · ${tag}` }])
    messages.current.push({ role: "user", content: text })
    const tools = modelContextTools(set.has)
    const add = (line: Line) => setLines((prev) => [...prev, line])
    try {
      let page: Entry[] = []
      let input: unknown
      await runTurn(messages.current, callClaudeWith(tools), toolbox(), (event) => {
        if (event.kind === "text") return add({ who: "claude", text: event.text })
        if (event.kind === "refusal")
          return add({ who: "error", text: `Claude declined (${event.category ?? "no category"})` })
        if (event.kind === "call") {
          input = event.input
          return add({ who: "asked", text: `${event.name} ${JSON.stringify(event.input)}` })
        }
        // query returns the same entries as snapshot, just fewer of them.
        if ((event.name === "snapshot" || event.name === "query") && !event.isError) {
          const entries: Entry[] = JSON.parse(event.output)
          if (Array.isArray(entries))
            page = [...page.filter((e) => !entries.some((n) => n.ref === e.ref)), ...entries]
        }
        add({ who: "ran", text: describeRun(event.name, input, event.output, event.isError, page), tag })
      })
    } catch (error) {
      add({ who: "error", text: error instanceof Error ? error.message : String(error) })
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
          Reset tasks &amp; chat
        </Button>
      </header>
      <p className="product">
        Claude only picks a tool and writes its arguments as JSON. Code on this page runs it.
        {nativeWebMCP ? "" : " This browser has no WebMCP, so the page stands in for it."}
      </p>
      <p className="pipeline" aria-label="How a request flows">
        <span>You</span> → <span>Claude</span> → <span>JSON call</span> →{" "}
        <span className={route === "direct" ? "skipped" : undefined}>
          Chrome WebMCP{route === "direct" ? " (skipped)" : ""}
        </span>{" "}
        → <span>page code</span> → <span>task list</span>
      </p>
      <div className="tool-set">
        <span id="tool-set-label">Tools Claude can call</span>
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
        {toolSet !== "custom" && (
          <p className="note">
            Behind them is <code>agent</code> (from ui-sdk's <code>createAgent()</code>), which is not an AI. It's the
            page's interface for one: it lists the components and calls their setValue, the same code a person's click
            runs.
          </p>
        )}
        <span id="route-label">How the page runs Claude's call</span>
        <SegmentedControl
          aria-labelledby="route-label"
          value={route}
          disabled={busy}
          onValueChange={(value) => value && setRoute(value)}
        >
          {routes.map((r) => (
            <SegmentedControlItem key={r.value} value={r.value}>
              {r.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <p>
          {routes.find((r) => r.value === route)!.detail}
          {route === "webmcp" && toolSet !== "custom" ? " ui-sdk's tools are registered by registerTools(agent)." : ""}
        </p>
        <p className="note">
          Either tool set works with either route. ui-sdk is not built on WebMCP and doesn't need it. With either set,
          Delete waits for a person to approve.
        </p>
      </div>
      <ol>
        {lines.map((line, i) => (
          <li key={i} data-who={line.who}>
            {line.who === "asked" && <span className="step">Claude called</span>}
            {line.who === "ran" && <span className="step">Page ran</span>}
            <span className="text">{line.text}</span>
            {line.tag && <span className="tag">{line.tag}</span>}
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
