/**
 * The line a control answers on. A button that could not do what it offers
 * says so where the player pressed it, on the reserved line inside its own
 * group (`[data-notes]` round the control, `[data-note]` for the line), rather
 * than across the panel's foot, which is for what the panel as a whole is
 * doing.
 */
export function note(control: HTMLElement, message: string): void {
  const slot = control.closest<HTMLElement>('[data-notes]')?.querySelector<HTMLElement>('[data-note]')
  if (slot) slot.textContent = message
}
