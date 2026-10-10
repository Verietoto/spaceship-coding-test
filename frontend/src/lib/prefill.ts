// Put a question in the command bar without sending it (the tour's last card offers a few to try).
export const PREFILL_ASK = 'spaceship:prefill-ask'

export function prefillAsk(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(PREFILL_ASK, { detail: text }))
}
