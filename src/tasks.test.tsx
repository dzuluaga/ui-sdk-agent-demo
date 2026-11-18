import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"
import { Tasks } from "./tasks"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

test("an agent assigns with the custom picker, changes status, and needs a person to delete", async () => {
  render(<Tasks />)

  const components = agent.snapshot().filter((entry) => !entry.offPage)
  console.log(JSON.stringify(components.filter((c) => c.component === "assign-picker"), null, 2))
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const label of [
    "Assignee for Fix login bug",
    "Status for Fix login bug",
    "Delete Update stale onboarding doc",
  ]) {
    expect(labels, `${label} is missing`).toContain(label)
  }

  const result = await agent.act({
    steps: [
      { ref: "Assignee for Fix login bug", action: "setValue", args: ["Jane Doe"] },
      { ref: "Status for Fix login bug", action: "setValue", args: ["In progress"] },
    ],
  })
  console.log("act result:", JSON.stringify(result.steps))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "Jane Doe" })).toBeTruthy()

  const wrong = await agent.act({
    steps: [{ ref: "Assignee for Fix login bug", action: "setValue", args: ["Bob"] }],
  })
  console.log("unknown person:", wrong.error?.message)
  expect(wrong.ok).toBe(false)

  const remove = {
    steps: [{ ref: "Delete Update stale onboarding doc", action: "press" }],
  }
  const refused = await agent.act(remove)
  console.log("delete without approval:", refused.error?.message)
  expect(refused.ok).toBe(false)
  expect(screen.getByText("Update stale onboarding doc")).toBeTruthy()

  approve = true
  const deleted = await agent.act(remove)
  expect(deleted.ok, deleted.error?.message).toBe(true)
  expect(screen.queryByText("Update stale onboarding doc")).toBeNull()
})
