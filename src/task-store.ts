import { useSyncExternalStore } from "react"
import type { Person } from "./assign-picker"

type Task = { id: string; title: string; assignee: string | null; status: string }

const people: Person[] = [
  { value: "jane", label: "Jane Doe" },
  { value: "ravi", label: "Ravi Patel" },
  { value: "mei", label: "Mei Chen" },
  { value: "sam", label: "Sam Okafor" },
]

const statuses = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
]

const initialTasks: Task[] = [
  { id: "t1", title: "Fix login bug", assignee: null, status: "todo" },
  { id: "t2", title: "Write release notes", assignee: "ravi", status: "doing" },
  { id: "t3", title: "Update stale onboarding doc", assignee: "mei", status: "todo" },
]

// The task list lives outside React so code other than the UI, like the
// hand-written WebMCP tools, can read and change it.
let tasks = initialTasks
const listeners = new Set<() => void>()

const taskStore = {
  get: () => tasks,
  set(next: Task[]) {
    tasks = next
    for (const listener of listeners) listener()
  },
  update(id: string, patch: Partial<Task>) {
    taskStore.set(tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)))
  },
  remove(id: string) {
    taskStore.set(tasks.filter((task) => task.id !== id))
  },
  reset() {
    taskStore.set(initialTasks)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

const useTasks = () => useSyncExternalStore(taskStore.subscribe, taskStore.get)

export { people, statuses, taskStore, useTasks, type Task }
