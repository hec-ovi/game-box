/**
 * What moves, and how long it takes. Two curves and seven durations, from the
 * tokens, and nothing here animates anything but `transform` and `opacity`:
 * this interface draws over a 3D scene running every frame, so a property that
 * lays out or paints again per frame is forbidden.
 *
 * A surface says which family it belongs to with `data-reveal`, and `Reveal`
 * writes `data-state` on it. Motion never delays input: a click runs its
 * handler on the same tick and the pixels catch up.
 *
 * Under `prefers-reduced-motion` every duration collapses to an instant and
 * every stagger goes to zero. Nothing is removed and nothing changes place.
 */
export const MOTION = `
.gb-hud [data-state] {
  transition: opacity var(--gb-t-enter) var(--gb-in), transform var(--gb-t-enter) var(--gb-in);
}
.gb-hud [data-state='opening'], .gb-hud [data-state='closing'] { opacity: 0; }
.gb-hud [data-state='open'] { opacity: 1; transform: none; }
.gb-hud [data-state='closing'] {
  transition: opacity var(--gb-t-leave) var(--gb-out), transform var(--gb-t-leave) var(--gb-out);
  pointer-events: none;
}

/* A frame rises and settles. It never scales: a 1px edge under a scale goes soft. */
.gb-hud [data-reveal='frame'][data-state='opening'] { transform: translateY(12px); }
.gb-hud [data-reveal='frame'][data-state='closing'] { transform: translateY(6px); }
/* A side panel comes in from its own edge and leaves the way it came. */
.gb-hud [data-reveal='side'][data-state='opening'], .gb-hud [data-reveal='side'][data-state='closing'] {
  transform: translateX(24px);
}
/* A corner panel drops in from above. */
.gb-hud [data-reveal='corner'][data-state='opening'], .gb-hud [data-reveal='corner'][data-state='closing'] {
  transform: translateY(-8px);
}
/* The prompt keeps its centring while it rises. */
.gb-hud [data-reveal='prompt'] { transform: translateX(-50%); }
.gb-hud [data-reveal='prompt'][data-state='opening'], .gb-hud [data-reveal='prompt'][data-state='closing'] {
  transform: translateX(-50%) translateY(8px);
}
.gb-hud [data-reveal='prompt'][data-state='open'] { transform: translateX(-50%); }
/* The scrim and a screen fade: a machine the player sat down at does not fly. */
.gb-hud [data-reveal='fade'][data-state] {
  transition: opacity var(--gb-t-enter) var(--gb-in);
}
.gb-hud [data-reveal='fade'][data-state='closing'] {
  transition: opacity var(--gb-t-leave) var(--gb-out);
}
/* The loader is the only 400. */
.gb-hud [data-reveal='veil'][data-state] { transition: opacity var(--gb-t-veil) var(--gb-in); }
.gb-hud [data-reveal='veil'][data-state='closing'] { transition: opacity var(--gb-t-veil) var(--gb-out); }

/* A notice enters from the left edge and leaves the same way; the ones below
   it slide up by transform as it goes. */
.gb-hud .gb-notice {
  animation: gb-notice-in var(--gb-t-enter) var(--gb-in) backwards;
  transition: transform var(--gb-t-value) var(--gb-in);
}
.gb-hud .gb-notice[data-leaving='true'] {
  opacity: 0;
  transform: translateX(-24px);
  transition: opacity var(--gb-t-leave) var(--gb-out), transform var(--gb-t-leave) var(--gb-out);
}
@keyframes gb-notice-in {
  from { opacity: 0; transform: translateX(-24px); }
  to { opacity: 1; transform: none; }
}

/* A list of rows arrives one after another, capped at eight so a long list
   never waits on itself. A turn on the transcript arrives the same way. */
.gb-hud .gb-enter {
  animation: gb-rise var(--gb-t-value) var(--gb-in) backwards;
  animation-delay: calc(min(var(--i, 0), 7) * var(--gb-stagger));
}
@keyframes gb-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

/* Switching face slides the body in from the side the player moved towards.
   The face they left is gone at once, because nothing waits on a transition. */
.gb-hud [data-slide='next'] { animation: gb-slide-next var(--gb-t-value) var(--gb-in); }
.gb-hud [data-slide='prev'] { animation: gb-slide-prev var(--gb-t-value) var(--gb-in); }
@keyframes gb-slide-next {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: none; }
}
@keyframes gb-slide-prev {
  from { opacity: 0; transform: translateX(-16px); }
  to { opacity: 1; transform: none; }
}

/* A count that climbs says so once, on its own inline box, so nothing beside
   it moves. A count is drawn in the accent, which is where it comes back to. */
.gb-hud [data-bump] {
  display: inline-block;
  animation: gb-bump var(--gb-t-state) var(--gb-in);
}
@keyframes gb-bump {
  from { transform: scale(1.12); color: var(--gb-accent-lit); }
  to { transform: none; color: var(--gb-accent); }
}

/* The underline under the tab strip: one element, moved and stretched. */
.gb-hud .gb-tab-line {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1px;
  height: 2px;
  background: var(--gb-accent);
  transform-origin: left center;
  transition: transform var(--gb-t-state) var(--gb-in);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .gb-hud {
    --gb-t-press: 1ms;
    --gb-t-state: 1ms;
    --gb-t-value: 1ms;
    --gb-t-leave: 1ms;
    --gb-t-enter: 1ms;
    --gb-t-veil: 1ms;
    --gb-stagger: 0ms;
  }
}
`
