# ui-sdk agent demo

A checkout built with [ui-sdk](https://github.com/vercel-labs/ui) (`0.1.0-beta.6`) that an agent can operate by name through `createAgent`, with a person approving the payment.

- `src/checkout.tsx`: Email, Card number (redacted to the agent automatically), Shipping (the app cancels agent picks over $20), Gift wrap, and a Pay button with `data-agent-confirm` built from app state.
- `src/checkout.test.tsx`: the agent snapshots the page, fills it, is refused Overnight, is refused Pay, then pays once approved.
- `src/main.tsx`: puts the bridge on `window.agent` and answers `allow` with an Approve/Deny bar.

```bash
npm test          # agent test in jsdom (add --silent=false to see the snapshot)
npm run dev       # then in the console:
await agent.act({ steps: [{ ref: "Email", action: "setValue", args: ["me@example.com"] }] })
await agent.act({ steps: [{ ref: "Pay", action: "press" }] })   # shows the approval bar
```

Gotcha: a change the app cancels still returns `ok: true` (the step's `result` is `false`). Check `values`, not `ok`.

## Talk to it through Claude

`src/tools.ts` hands ui-sdk's `agentTools` (snapshot, act, query) to Claude. The browser runs the tool loop (`src/claude-loop.ts`) because the tools act on the page. The Vite dev server's `/api/claude` route (`server/claude.ts`) makes the call, so the API key stays on the server. It calls `claude-opus-5-5` at `medium` effort with server-side refusal fallbacks (`fallbacks: "default"`).

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local   # gitignored
npm run dev
```

Type a request in "Ask Claude" under the form. Each tool call shows up in the log. When Claude presses Pay, the Approve/Deny bar waits for you, and Claude hears your answer as the tool result.
