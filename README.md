# ui-sdk agent demo

A small app built with [ui-sdk](https://github.com/vercel-labs/ui) (`0.1.0-beta.6`) that a person and an agent operate on the same screen. The agent doesn't click pixels or guess selectors: it reads the components the page exposes and calls their actions by name, and the app decides what it may do.

```bash
npm install
npm test        # agent tests in jsdom (add --silent=false to see the snapshot)
npm run dev     # http://localhost:5173
```

## What's on the page

**Sprint tasks** (`src/tasks.tsx`): each row has an "Assign to" picker, a Status select and a Delete button that needs a person's approval (`data-agent-confirm`).

**Assign-to picker** (`src/assign-picker.ts`, 134 lines; React parts in `src/assign-picker-react.tsx`, 44 lines): a component ui-sdk doesn't ship, composed from its behaviors: a popup (open, close, focus return), a listbox (highlight, arrows, filter as you type) and a change (reports to the app). One line makes it agent-ready: `agent: { actions: ["setValue"], closed: true }`. There's no focus or keyboard code of our own. The tests in `src/assign-picker.test.tsx` were checked by breaking Enter, filtering and the agent hint one at a time; each break fails a test.

**Checkout** (`src/checkout.tsx`): Email, Card number (redacted from the agent automatically), Shipping (the app cancels agent picks over $20), Gift wrap, and a Pay button whose confirm text comes from app state.

## Drive it as an agent

From the browser console:

```js
await agent.act({ steps: [
  { ref: "Assignee for Fix login bug", action: "setValue", args: ["Jane Doe"] },
  { ref: "Status for Fix login bug", action: "setValue", args: ["In progress"] },
  { ref: "Delete Update stale onboarding doc", action: "press" },  // waits for Approve
] })
```

The first two steps run; the Delete stops at "Claude wants to: Deletes the task …" until a person clicks Approve or Deny. Naming someone who isn't on the team (`"Bob"`) fails with the real list of people.

Gotcha: a change the app cancels still returns `ok: true` (the step's `result` is `false`). Check `values`, not `ok`.

## Talk to it through Claude

`src/tools.ts` hands ui-sdk's `agentTools` (snapshot, act, query) to Claude. The browser runs the tool loop (`src/claude-loop.ts`) because the tools act on the page. The Vite dev server's `/api/claude` route (`server/claude.ts`) makes the call, so the API key stays on the server.

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local   # gitignored
npm run dev
```

Type "assign the login bug to Jane, mark it in progress, and delete the stale task" in "Ask Claude". Each tool call shows up in the log, and the Delete waits for you.

## What this shows

- **An API the UI exposes to agents.** `snapshot()` lists each component, its label, value, items and actions. `act()` calls an action through the component's own change path, so app state, callbacks and rules run as they would for a person, and the person sees it happen.
- **The app stays in charge.** Every agent change arrives with `details.source === "agent"`, so the app can `cancel()` it (the shipping cap), require a person (`data-agent-confirm`), hide a value (`data-agent-secret`) or hide a region (`data-agent-hidden`).
- **Versus computer use, browser automation or jQuery.** Those infer intent from screenshots, the DOM or selectors and bypass the app's logic. Here the page describes itself, and the calls go through the components.
- **Versus WebMCP.** WebMCP is the channel for a page to offer tools to an in-browser agent; you hand-write each tool. ui-sdk generates generic tools from the UI, and `registerTools` publishes them through WebMCP. Both fit in one app: named tools for the key operations, ui-sdk for the rest of the screen.
- **The gap: existing apps.** Only ui-sdk components show up in `snapshot()`. A plain `<button>` or `<select>`, or an existing component or web component library, is invisible to the agent until it's moved onto ui-sdk parts or behaviors. The docs offer no adapter for components you already have.
