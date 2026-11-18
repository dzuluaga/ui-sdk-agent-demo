// The Approve/Deny bar in index.html. Every path that needs a person, ui-sdk's
// data-agent-confirm and the hand-written WebMCP tools alike, asks through it.
function askThePerson(text: string, signal?: AbortSignal) {
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
    signal?.addEventListener("abort", answer(false))
  })
}

export { askThePerson }
