import { createAgent } from "@ui-sdk/react/agent"
import { createRoot } from "react-dom/client"
import { Checkout } from "./checkout"

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

createRoot(document.getElementById("root")!).render(<Checkout />)

const agent = createAgent({
  allow: (step, { signal }) =>
    step.confirm ? askThePerson(step.confirm, signal) : true,
})

declare global {
  var agent: ReturnType<typeof createAgent>
}
globalThis.agent = agent
