import { act, render, screen } from "@testing-library/react"
import { agentTools, createAgent, registerTools } from "@ui-sdk/react/agent"
import { afterEach, beforeAll, expect, test } from "vitest"
import { taskStore } from "./task-store"
import { Tasks } from "./tasks"
import { installModelContext, modelContextToolbox, modelContextTools } from "./webmcp"
import { registerTaskTools } from "./webmcp-tools"

const agent = createAgent({ allow: (step) => !step.confirm })

beforeAll(() => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="approval"><span id="approval-text"></span><button id="deny"></button><button id="approve"></button></div>`
  )
  installModelContext()
  registerTools(agent, { allow: () => true })
  registerTaskTools()
})
afterEach(() => act(() => taskStore.reset()))

const run = (name: string, input: object) => act(() => modelContextToolbox.run(name, input))

test("both tool sets reach the page through document.modelContext", () => {
  const names = modelContextTools(() => true).map((tool) => tool.name)
  expect(names).toEqual([
    ...agentTools.map((tool) => tool.name),
    "list_tasks",
    "assign_task",
    "set_status",
    "delete_task",
  ])
})

test("a hand-written tool changes the same screen a person uses", async () => {
  render(<Tasks />)
  const result = await run("assign_task", { task: "login", person: "Jane Doe" })
  expect(result).toEqual({ output: 'Assigned "Fix login bug" to Jane Doe.', isError: false })
  expect(screen.getByRole("button", { name: "Jane Doe" })).toBeTruthy()

  const wrong = await run("assign_task", { task: "login", person: "Bob" })
  expect(wrong.isError).toBe(true)
  expect(wrong.output).toContain("Choices: Jane Doe, Ravi Patel, Mei Chen, Sam Okafor")
})

test("ui-sdk's generated act goes through the same registry and keeps its confirm", async () => {
  render(<Tasks />)
  const assigned = await run("act", {
    steps: [{ ref: "Assignee for Fix login bug", action: "setValue", args: ["Mei Chen"] }],
  })
  expect(assigned.isError).toBe(false)
  expect(screen.getAllByRole("button", { name: "Mei Chen" })).toHaveLength(2)

  const deleted = await run("act", {
    steps: [{ ref: "Delete Update stale onboarding doc", action: "press" }],
  })
  expect(deleted.isError).toBe(true)
  expect(screen.getByText("Update stale onboarding doc")).toBeTruthy()
})

test("the hand-written delete asks the person itself", async () => {
  render(<Tasks />)
  const pending = run("delete_task", { task: "stale" })
  expect(document.getElementById("approval-text")!.textContent).toBe(
    'Deletes the task "Update stale onboarding doc"'
  )
  document.getElementById("deny")!.click()
  expect((await pending).output).toBe("The person said no.")
  expect(screen.getByText("Update stale onboarding doc")).toBeTruthy()
})
