"use client"

import { createParts, type PartProps } from "@ui-sdk/react/primitive"
import { assignPicker, type AssignPickerOptions } from "./assign-picker"

const parts = createParts(assignPicker, {
  root: "div",
  trigger: "button",
  content: "div",
  search: "input",
  list: "div",
  option: "div",
})

function AssignPicker({
  people,
  value,
  ...props
}: AssignPickerOptions & Omit<PartProps<"div">, "defaultValue">) {
  const assignee = people.find((person) => person.value === value)
  return (
    <parts.Root people={people} value={value} {...props}>
      <parts.Trigger>{assignee?.label ?? "Unassigned"}</parts.Trigger>
      <parts.Content initialFocus='[data-slot="assign-picker-search"]'>
        <parts.Search aria-label="Search people" placeholder="Search people…" />
        <parts.List aria-label="People">
          {people.map((person) => (
            <parts.Option key={person.value} value={person.value}>
              <span className="avatar" aria-hidden="true">
                {person.label
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </span>
              {person.label}
            </parts.Option>
          ))}
        </parts.List>
      </parts.Content>
    </parts.Root>
  )
}

export { AssignPicker }
