import { createAgent } from "@ui-sdk/react/agent"
import { createRoot } from "react-dom/client"
import { Chat } from "./chat"
import { Checkout } from "./checkout"
import "./styles.css"
import { Tasks } from "./tasks"

function askThePerson(text: string, signal: AbortSignal) {
  const bar = document.getElementById("approval")!
  document.getElementById("approval-text")!.textContent = text
  bar.toggleAttribute("data-open", true)
  return new Promise<boolean>((resolve) => {
    const answer = (yes: boolean) => () => {
      bar.toggleAttribute("data-open", false)
      resolve(yes)
    }
    document.getElementById("approve")!.onclick = answer(true)
    document.getElementById("deny")!.onclick = answer(false)
    signal.addEventListener("abort", answer(false))
  })
}

const agent = createAgent({
  allow: (step, { signal }) =>
    step.confirm ? askThePerson(step.confirm, signal) : true,
})

createRoot(document.getElementById("root")!).render(
  <>
    <Tasks />
    <Chat agent={agent} />
    <Checkout />
  </>
)

declare global {
  var agent: ReturnType<typeof createAgent>
}
globalThis.agent = agent
