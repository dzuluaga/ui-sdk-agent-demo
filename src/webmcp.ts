import type Anthropic from "@anthropic-ai/sdk"
import type { Toolbox } from "./claude-loop"

// The WebMCP tool shape: what a page passes to document.modelContext.registerTool.
type ModelContextTool = {
  name: string
  description: string
  inputSchema: object
  annotations?: Record<string, boolean>
  execute: (input: any, client?: unknown) => unknown
}

type ModelContext = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>
  // Chrome's native one also lets an agent in the page find and run tools.
  getTools?: () => Promise<{ name: string }[]>
  executeTool?: (tool: { name: string }, input: object) => Promise<string>
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
}

const registered = new Map<string, ModelContextTool>()
let native: ModelContext | undefined

// Records every tool the page registers so the in-page Claude can call them,
// and passes each one on to the browser's own document.modelContext when it
// has one. Without a native one this stands in for it.
function installModelContext() {
  native = document.modelContext
  const context: ModelContext = {
    registerTool(tool, options) {
      registered.set(tool.name, tool)
      options?.signal?.addEventListener("abort", () => registered.delete(tool.name))
      return native ? native.registerTool(tool, options) : Promise.resolve()
    },
  }
  Object.defineProperty(document, "modelContext", { value: context, configurable: true })
  return { native: Boolean(native) }
}

// What Claude sees: the registered tools, as Messages API tool definitions.
function modelContextTools(names: (name: string) => boolean): Anthropic.Beta.BetaTool[] {
  return [...registered.values()]
    .filter((tool) => names(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
    }))
}

// Runs a tool through the browser's WebMCP when it has one, so the call shows
// up in DevTools (Application → WebMCP → Tool Activity); otherwise straight
// through the tool's own execute.
async function execute(name: string, input: object) {
  if (native?.getTools && native.executeTool) {
    const tool = (await native.getTools()).find((t) => t.name === name)
    if (tool) {
      const text = await native.executeTool(tool, input ?? {})
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
  }
  const tool = registered.get(name)
  if (!tool) throw new Error(`No WebMCP tool named ${name}`)
  return tool.execute(input)
}

// Calls a registered tool's own execute, skipping the browser's WebMCP, so
// DevTools never sees the call.
async function executeDirect(name: string, input: object) {
  const tool = registered.get(name)
  if (!tool) throw new Error(`No WebMCP tool named ${name}`)
  return tool.execute(input)
}

const toolboxFor = (run: (name: string, input: object) => Promise<unknown>): Toolbox => ({
  async run(name, input) {
    try {
      const output: any = await run(name, input)
      const failed = output?.ok === false || (output && typeof output === "object" && "error" in output)
      return { output, isError: Boolean(failed) }
    } catch (error) {
      return { output: error instanceof Error ? error.message : String(error), isError: true }
    }
  },
})

// How the in-page Claude calls them, as a browser agent would.
const modelContextToolbox = toolboxFor(execute)
// The same tools as plain functions, without WebMCP.
const directToolbox = toolboxFor(executeDirect)

export { directToolbox, installModelContext, modelContextToolbox, modelContextTools, type ModelContextTool }
