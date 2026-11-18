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
