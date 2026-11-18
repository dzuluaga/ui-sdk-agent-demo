import type Anthropic from "@anthropic-ai/sdk"
import { agentTools } from "@ui-sdk/react/agent"

const tools: Anthropic.Beta.BetaTool[] = agentTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
}))

export { tools }
