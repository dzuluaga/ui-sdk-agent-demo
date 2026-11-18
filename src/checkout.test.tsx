import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"
import { Checkout } from "./checkout"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

test("an agent fills the checkout, is capped on shipping, and needs a person to pay", async () => {
  render(<Checkout />)

  const components = agent.snapshot().filter((entry) => !entry.offPage)
  console.log(JSON.stringify(components, null, 2))
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const label of ["Email", "Card number", "Shipping", "Gift wrap"]) {
    expect(labels).toContain(label)
  }

  const fill = await agent.act({
    steps: [
      { ref: "Email", action: "setValue", args: ["diego@example.com"] },
      { ref: "Card number", action: "setValue", args: ["4242424242424242"] },
      { ref: "Shipping", action: "setValue", args: ["Express"] },
      { ref: "Gift wrap", action: "setChecked", args: [true] },
    ],
  })
  console.log("fill result:", JSON.stringify(fill, null, 2))
  expect(fill.ok, fill.error?.message).toBe(true)
  expect(JSON.stringify(fill)).not.toContain("4242424242424242")
  expect(screen.getByRole("status", { name: "Total" }).textContent).toBe("Total: $50")

  const overnight = await agent.act({
    steps: [{ ref: "Shipping", action: "setValue", args: ["Overnight"] }],
  })
  console.log("overnight result:", JSON.stringify(overnight, null, 2))
  expect(screen.getByRole("status", { name: "Total" }).textContent).toBe("Total: $50")

  const pay = { steps: [{ ref: "Pay", action: "press" }] }
  const refused = await agent.act(pay)
  console.log("pay without approval:", refused.error?.message)
  expect(refused.ok).toBe(false)
  expect(screen.getByRole("status", { name: "Payment" }).textContent).toBe("Not paid")

  approve = true
  const paid = await agent.act(pay)
  expect(paid.ok, paid.error?.message).toBe(true)
  expect(screen.getByRole("status", { name: "Payment" }).textContent).toBe("Paid $50")
})
