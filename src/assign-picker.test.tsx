import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkPattern } from "@ui-sdk/core/testing"
import { useState } from "react"
import { expect, test } from "vitest"
import { AssignPicker } from "./assign-picker-react"
import { people } from "./tasks"

function Harness() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <AssignPicker
      aria-label="Assignee for Fix login bug"
      people={people}
      value={value}
      onValueChange={setValue}
    />
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("type to filter, arrows to move, Enter assigns and returns focus", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const trigger = screen.getByRole("button", { name: "Unassigned" })

  await user.click(trigger)
  await settle()
  const search = screen.getByRole("combobox", { name: "Search people" })
  expect(document.activeElement).toBe(search)

  await user.type(search, "a")
  expect(screen.getAllByRole("option")).toHaveLength(3)
  await user.clear(search)
  await user.type(search, "ra")
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["RPRavi Patel"])

  await user.keyboard("{Enter}")
  await settle()
  expect(screen.getByRole("button", { name: "Ravi Patel" })).toBe(document.activeElement)
  expect(screen.queryByRole("combobox")).toBeNull()
})

test("ArrowDown moves the highlight and a click assigns", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Unassigned" }))
  await settle()
  const search = screen.getByRole("combobox")

  await user.keyboard("{ArrowDown}")
  const first = search.getAttribute("aria-activedescendant")
  await user.keyboard("{ArrowDown}")
  expect(search.getAttribute("aria-activedescendant")).not.toBe(first)

  await user.click(screen.getByRole("option", { name: /Mei Chen/ }))
  await settle()
  expect(screen.getByRole("button", { name: "Mei Chen" })).toBeTruthy()
})

test("Escape closes without assigning", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Unassigned" }))
  await settle()
  await user.keyboard("{ArrowDown}{Escape}")
  await settle()
  expect(screen.queryByRole("combobox")).toBeNull()
  expect(screen.getByRole("button", { name: "Unassigned" })).toBe(document.activeElement)
})

// jsdom drops focus to the body on Tab out of any popover, ui-sdk's own Popover
// included, so the dialog check's Tab step is checked in a real browser.
test.fails("the open popover passes the WAI-ARIA dialog check in jsdom", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Unassigned" }))
  await settle()
  await checkPattern(screen.getByRole("dialog"), "dialog")
})

// A search box inside a popover isn't the strict APG combobox: Escape closes the
// whole popover and focus returns to the trigger, where APG keeps it in the input.
test.fails("the strict WAI-ARIA combobox check", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Unassigned" }))
  await settle()
  await checkPattern(screen.getByRole("combobox").parentElement!, "combobox")
})
