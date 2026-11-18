import { askThePerson } from "./approval"
import { people, statuses, taskStore, type Task } from "./task-store"

// Task tools written by hand against the app's own data, the way a page
// author offers named actions through WebMCP. Each one finds its task,
// checks its arguments and asks a person itself: nothing comes for free.

const byTitle = (title: string): Task => {
  const all = taskStore.get()
  const matches = all.filter((task) => task.title.toLowerCase().includes(String(title).toLowerCase()))
  if (matches.length === 1) return matches[0]
  const titles = all.map((task) => task.title).join(", ")
  throw new Error(
    matches.length ? `"${title}" matches several tasks: ${titles}.` : `No task "${title}". Tasks: ${titles}.`
  )
}

const pick = <T extends { value: string; label: string }>(list: T[], name: string, what: string) => {
  const found = list.find(
    (item) => [item.value, item.label].some((text) => text.toLowerCase() === String(name).toLowerCase())
  )
  if (!found) throw new Error(`No ${what} "${name}". Choices: ${list.map((item) => item.label).join(", ")}.`)
  return found
}

const taskArg = { task: { type: "string", description: "The task's title, or a unique part of it" } }

function registerTaskTools() {
  const controller = new AbortController()
  const register = (tool: Parameters<NonNullable<Document["modelContext"]>["registerTool"]>[0]) =>
    document.modelContext?.registerTool(tool, { signal: controller.signal })

  register({
    name: "list_tasks",
    description: "Lists the sprint tasks with their assignee and status.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () =>
      taskStore.get().map((task) => ({
        title: task.title,
        assignee: people.find((person) => person.value === task.assignee)?.label ?? null,
        status: statuses.find((status) => status.value === task.status)?.label,
      })),
  })

  register({
    name: "assign_task",
    description: "Assigns a task to a teammate.",
    inputSchema: {
      type: "object",
      properties: { ...taskArg, person: { type: "string", description: "The teammate's name" } },
      required: ["task", "person"],
    },
    execute: ({ task, person }) => {
      const found = byTitle(task)
      const teammate = pick(people, person, "teammate")
      taskStore.update(found.id, { assignee: teammate.value })
      return `Assigned "${found.title}" to ${teammate.label}.`
    },
  })

  register({
    name: "set_status",
    description: "Sets a task's status: To do, In progress or Done.",
    inputSchema: {
      type: "object",
      properties: { ...taskArg, status: { type: "string", enum: statuses.map((s) => s.label) } },
      required: ["task", "status"],
    },
    execute: ({ task, status }) => {
      const found = byTitle(task)
      const next = pick(statuses, status, "status")
      taskStore.update(found.id, { status: next.value })
      return `"${found.title}" is now ${next.label}.`
    },
  })

  register({
    name: "delete_task",
    description: "Deletes a task. A person must approve it.",
    inputSchema: { type: "object", properties: taskArg, required: ["task"] },
    // WebMCP has no confirmation API yet: the hint tells the browser's agent,
    // and the tool still asks the person itself.
    annotations: { consequentialHint: true },
    execute: async ({ task }) => {
      const found = byTitle(task)
      if (!(await askThePerson(`Deletes the task "${found.title}"`))) throw new Error("The person said no.")
      taskStore.remove(found.id)
      return `Deleted "${found.title}".`
    },
  })

  return () => controller.abort()
}

export { registerTaskTools }
