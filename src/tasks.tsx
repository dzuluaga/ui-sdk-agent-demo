import { Button } from "@ui-sdk/react/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { useState } from "react"
import type { Person } from "./assign-picker"
import { AssignPicker } from "./assign-picker-react"

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

type Task = { id: string; title: string; assignee: string | null; status: string }

const initialTasks: Task[] = [
  { id: "t1", title: "Fix login bug", assignee: null, status: "todo" },
  { id: "t2", title: "Write release notes", assignee: "ravi", status: "doing" },
  { id: "t3", title: "Update stale onboarding doc", assignee: "mei", status: "todo" },
]

function Tasks() {
  const [tasks, setTasks] = useState(initialTasks)
  const update = (id: string, patch: Partial<Task>) =>
    setTasks((all) => all.map((task) => (task.id === id ? { ...task, ...patch } : task)))

  return (
    <section className="card tasks" aria-labelledby="tasks-title">
      <h1 id="tasks-title">Sprint tasks</h1>
      <p className="product">
        <span>{tasks.length} tasks</span>
        <span>{tasks.filter((task) => task.status === "done").length} done</span>
      </p>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} data-status={task.status}>
            <span className="title">{task.title}</span>
            <AssignPicker
              aria-label={`Assignee for ${task.title}`}
              people={people}
              value={task.assignee}
              onValueChange={(assignee) => update(task.id, { assignee })}
            />
            <div className="cell">
            <Select
              items={statuses}
              value={task.status}
              onValueChange={(status) => status && update(task.id, { status })}
            >
              <SelectTrigger aria-label={`Status for ${task.title}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <Button
              aria-label={`Delete ${task.title}`}
              data-agent-confirm={`Deletes the task "${task.title}"`}
              onClick={() => setTasks((all) => all.filter((t) => t.id !== task.id))}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export { people, Tasks }
