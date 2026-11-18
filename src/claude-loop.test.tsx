import type Anthropic from "@anthropic-ai/sdk"
import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"
import { Checkout } from "./checkout"
import { agentToolbox, runTurn, type CallClaude, type Event } from "./claude-loop"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

const reply = (
  stop_reason: "tool_use" | "end_turn",
  content: unknown[]
) => ({ stop_reason, content }) as unknown as Anthropic.Beta.BetaMessage

const script = [
  reply("tool_use", [
    { type: "tool_use", id: "t1", name: "act", input: { steps: [
      { ref: "Email", action: "setValue", args: ["me@example.com"] },
      { ref: "Card number", action: "setValue", args: ["4242424242424242"] },
      { ref: "Shipping", action: "setValue", args: ["Express"] },
      { ref: "Gift wrap", action: "setChecked", args: [true] },
    ] } },
  ]),
  reply("tool_use", [
    { type: "tool_use", id: "t2", name: "act", input: { steps: [{ ref: "Pay", action: "press" }] } },
  ]),
  reply("end_turn", [{ type: "text", text: "Filled in; you need to approve the $50 payment." }]),
]

test("the loop runs Claude's tool calls against the page and sends back results", async () => {
  render(<Checkout />)
  const sent: Anthropic.Beta.BetaMessageParam[][] = []
  const callClaude: CallClaude = async (messages) => {
    sent.push(structuredClone(messages))
    return script[sent.length - 1]
  }
  const events: Event[] = []
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: "Check out with express and gift wrap" },
  ]

  await runTurn(messages, callClaude, agentToolbox(agent), (event) => events.push(event))

  expect(sent).toHaveLength(3)
  expect(screen.getByRole("status", { name: "Total" }).textContent).toBe("Total: $50")
  expect(screen.getByRole("status", { name: "Payment" }).textContent).toBe("Not paid")

  const [fill, pay] = events.filter((e) => e.kind === "tool")
  expect(fill.kind === "tool" && fill.isError).toBe(false)
  expect(fill.kind === "tool" && fill.output).not.toContain("4242424242424242")
  expect(pay.kind === "tool" && pay.isError).toBe(true)
  expect(pay.kind === "tool" && pay.output).toContain("Charges $50 to the card ending 4242")

  const lastResults = sent[2].at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[]
  expect(lastResults[0]).toMatchObject({ tool_use_id: "t2", is_error: true })
  expect(events.at(-1)).toEqual({ kind: "text", text: "Filled in; you need to approve the $50 payment." })
})
