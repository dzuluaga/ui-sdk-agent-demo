import {
  createChange,
  createListbox,
  createPopup,
  definePrimitive,
  popupContent,
  popupState,
  popupTrigger,
  selects,
  type ChangeDetails,
} from "@ui-sdk/core"
import { popoverPreset } from "@ui-sdk/core/popover"

type Person = { value: string; label: string }

type AssignPickerOptions = {
  people: Person[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (
    value: string | null,
    details: ChangeDetails<"item-press" | "imperative">
  ) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: ChangeDetails<string>) => void
}

const assignPicker = definePrimitive({
  name: "assign-picker",
  options: {
    people: "list",
    value: "value",
    defaultValue: "value",
    onValueChange: "callback",
    open: "boolean",
    defaultOpen: "boolean",
    onOpenChange: "callback",
  },
  controlled: ["value"],
  state: (options: AssignPickerOptions) => ({
    ...popupState(options),
    value: options.value ?? options.defaultValue ?? null,
    items: options.people,
    query: "",
    highlighted: null as string | null,
  }),
  sync: (options) => ({
    items: options.people,
    ...(options.value === undefined ? {} : { value: options.value }),
  }),
  api: (context) => {
    const popup = createPopup(context, { preset: popoverPreset })
    const change = createChange(context)
    const listbox = createListbox(context, {
      key: "highlighted",
      focus: "virtual",
      query: () => context.store.get().query,
    })

    const setValue = (value: string | null, event?: Event) => {
      change("value", value, { reason: event ? "item-press" : "imperative", event })
      popup.close()
    }

    return {
      ...popup,
      listbox,
      setValue,
      search(query: string) {
        context.store.set({ query })
        listbox.move("first")
      },
      keydown(event: KeyboardEvent) {
        const { highlighted } = context.store.get()
        if (event.key === "Enter" && highlighted) {
          event.preventDefault()
          setValue(highlighted, event)
          return
        }
        listbox.keydown(event)
      },
    }
  },
  slots: (slot) => ({
    root: slot({ attrs: () => ({ role: "group" }) }),
    trigger: popupTrigger(slot),
    content: popupContent(slot),
    search: slot({
      role: "combobox",
      focus: "native",
      keys: ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Enter"],
      attrs: (state, { id, api }) => ({
        type: "text",
        autocomplete: "off",
        value: state.query,
        "aria-expanded": "true",
        "aria-controls": `${id}-list`,
        "aria-activedescendant": api.listbox.activeId(state),
      }),
      on: {
        input: (event, { api }) =>
          api.search((event.target as HTMLInputElement).value),
        keydown: (event, { api }) => api.keydown(event),
      },
    }),
    list: slot({
      role: "listbox",
      keys: { none: "the search input moves the highlight" },
      attrs: (_state, { id }) => ({ id: `${id}-list` }),
    }),
    option: slot<{ value: string }>({
      role: "option",
      focus: "active-descendant",
      props: { value: "string" },
      selects: selects({ highlighted: ({ key }) => [key, null] }),
      present: (_state, part) => part.api.listbox.shows(part),
      attrs: (state, part) => ({
        ...part.api.listbox.attrs(state, part),
        "aria-selected": String(state.value === part.key),
      }),
      press: ({ key, api }, event) => api.setValue(key, event),
      on: {
        pointerdown: (event) => event.preventDefault(),
        pointermove: (event, { key, api }) =>
          api.listbox.highlight(key, { event }),
      },
      bind: (el, part) => part.api.listbox.bind(el, part),
    }),
  }),
  agent: { actions: ["setValue"], closed: true },
})

export { assignPicker, type AssignPickerOptions, type Person }
