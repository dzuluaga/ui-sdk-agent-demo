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
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
}

const registered = new Map<string, ModelContextTool>()

// Records every tool the page registers so the in-page Claude can call them,
// and passes each one on to the browser's own document.modelContext when it
// has one. Without a native one this stands in for it.
function installModelContext() {
  const native = document.modelContext
  const context: ModelContext = {
    registerTool(tool, options) {
      registered.set(tool.name, tool)
      options?.signal?.addEventListener("abort", () => registered.delete(tool.name))
      return native ? native.registerTool.call(native, tool, options) : Promise.resolve()
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

// How the in-page Claude calls them: through each tool's execute, as a
// browser agent would.
const modelContextToolbox: Toolbox = {
  async run(name, input) {
    const tool = registered.get(name)
    if (!tool) return { output: `No WebMCP tool named ${name}`, isError: true }
    try {
      const output: any = await tool.execute(input)
      const failed = output?.ok === false || (output && typeof output === "object" && "error" in output)
      return { output, isError: Boolean(failed) }
    } catch (error) {
      return { output: error instanceof Error ? error.message : String(error), isError: true }
    }
  },
}

export { installModelContext, modelContextToolbox, modelContextTools, type ModelContextTool }
