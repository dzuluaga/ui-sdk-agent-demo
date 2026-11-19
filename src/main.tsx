import { createAgent, registerTools } from "@ui-sdk/react/agent"
import { createRoot } from "react-dom/client"
import { askThePerson } from "./approval"
import { Chat } from "./chat"
import { Checkout } from "./checkout"
import "./styles.css"
import { Tasks } from "./tasks"
import { installModelContext } from "./webmcp"
import { registerTaskTools } from "./webmcp-tools"

const agent = createAgent({
  allow: (step, { signal }) =>
    step.confirm ? askThePerson(step.confirm, signal) : true,
})

// WebMCP: ui-sdk's generated tools and the hand-written task tools both go
// through document.modelContext. The bridge's allow above already asks the
// person, so registerTools doesn't ask again.
const webmcp = installModelContext()
registerTools(agent, { allow: () => true })
registerTaskTools()

createRoot(document.getElementById("root")!).render(
  <>
    <Tasks />
    <Chat agent={agent} nativeWebMCP={webmcp.native} />
    <Checkout />
  </>
)

declare global {
  var agent: ReturnType<typeof createAgent>
}
globalThis.agent = agent
