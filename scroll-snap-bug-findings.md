# Scroll Snap in `AnimationsCleaner.svelte`

## What the component does

`AnimationsCleaner` is a component that responds to the user scrolling. It has two phases:

1. **Scrub phase** — As the user scrolls down, the video plays forward frame by frame. The further they scroll, the further into the video they get. Scrolling back up rewinds it.
2. **Overlay phase** — Once the video is done scrubbing, a series of full-screen panels appear. We want each panel to "snap" into place so the user moves through them one at a time, instead of being able to stop halfway between two panels.

This document compares the **original** version of the code to the **current** version, and explains _why_ the current version is built the way it is. Each section ends with a takeaway you can carry into other projects.

A quick vocab list before we start:

- **Viewport** — the visible part of the browser window. "100vh" means "100% of the viewport's height" (the full screen height).
- **Sticky element** — an element that scrolls normally with the page, then "sticks" to the top of the screen when you scroll past it, then unsticks again once its parent container scrolls out of view. Like a page header that follows you for a while and then leaves.
- **Scroll-snap** — a CSS feature that tells the browser "when the user stops scrolling, slide them to one of these specific positions instead of leaving them wherever they happened to stop." There are two modes:
  - `proximity` — only snap if the user stopped _near_ a snap point (lenient).
  - `mandatory` — _always_ snap to the nearest snap point (strict).
- **Snap target** — an element marked with `scroll-snap-align`, telling the browser "this is one of the positions you can snap to."

---

## Original architecture

In the original code, everything lived inside one tall scroll container. All the overlay panels were stacked on top of each other inside a sticky element, and tiny invisible "marker" divs were placed at calculated scroll positions to tell the browser where to snap.

```
.scrolly  (a tall container — covers the whole journey)
│
├── .sticky  (full-screen sized, position: sticky)
│   ├── video
│   └── overlay-panels   ← all panels stacked here, fading in/out
│                         based on how far the user has scrolled
│
└── .snap-target × N     ← tiny invisible 1×1 pixel divs placed
                           at specific scroll positions
```

The original code tried to:

- Mark the tiny `.snap-target` divs as snap points using `scroll-snap-align: start`
- Calculate their `top` values to match where each panel should "lock in"
- Turn on `scroll-snap-type: y proximity` on the `<html>` element only when in the overlay phase

---

## Current architecture

The current version is simpler. The video scrubber is its own self-contained box. The first overlay panel is the only thing that overlaps with the video — it fades in on top of it. The rest of the panels are normal full-screen sections, one after another, just like sections of a regular webpage.

```
html  ←── scroll-snap-type: y mandatory  (only on, when we're in the panel phase)
│
├── .scrubber  (a tall container — just for the video scrub)
│   └── .sticky  (full-screen, position: sticky)
│       ├── video
│       └── .first-overlay   ← fades in over the video as the user
│                              nears the end of the scrub
│
├── <section.overlay-section>   ← real full-screen section, has scroll-snap-align
├── <section.overlay-section>
└── <section.overlay-section>
```

Three big changes from the original:

1. **No more invisible marker divs.** Each panel is its own real, full-screen `<section>` element, and the snap points sit directly on those sections.
2. **The first panel is treated specially.** It lives over the video and fades in, while the rest of the panels are normal sections that the user scrolls into.
3. **Mandatory snap turns on _and_ off.** It's only active during a specific window — between the moment the scrub finishes and the moment the user reaches the very last panel.

---

## Why each piece is the way it is

### 1. Sections are real elements, not invisible marker divs

In the original, the snap targets were tiny `position: absolute` divs sitting _inside_ `.sticky`. Two things made this fail:

**Problem A: they were hidden from the browser.** `.sticky` had a CSS rule `overflow: hidden`, which means "don't let any content stick out beyond my edges." The marker divs were placed at scroll positions thousands of pixels away — well outside `.sticky`'s box — so they were clipped away. The browser's snap engine couldn't see them at all.

**Problem B: they were in the wrong coordinate system.** Sticky elements don't move with the page when the user scrolls past them — they stay glued to the top of the screen. So the markers' `top: 4050px` style was being measured from a place that doesn't really scroll. The browser never "scrolls past" something that isn't moving with the page, so the snap points never triggered.

The current code avoids both problems by skipping the marker divs entirely. Each panel is a real, full-screen `<section>` element in the normal flow of the page. We put `scroll-snap-align: start` directly on the section. The browser knows exactly where it is — because it's a real piece of the page being scrolled.

> **Takeaway:** Snap targets need to be in the same coordinate space as the actual scrolling. The simplest way to make sure that's true is to put `scroll-snap-align` on a real, full-size content element — not on a fake placeholder.

### 2. Mandatory snap, turned on by JavaScript — not proximity snap

The original code used `proximity` snap mode. Proximity is lenient: it only kicks in if the user happens to stop scrolling within about a third of a screen height from a snap point. Our panels were further apart than that, so most of the time the user just stopped wherever, and snap didn't activate. It felt broken.

The current code uses `mandatory` snap, which is strict: every time the user stops, the browser pulls them to the closest snap point, no matter what. But mandatory has a downside — if it's _always_ on, it interferes with the video scrub (where we want free, smooth scrolling). So we turn it on and off with JavaScript:

```js
// Figure out if we're inside the panel phase right now
const lastSection = sectionRefs[sectionRefs.length - 1];
const reachedLastSection = !!lastSection && lastSection.getBoundingClientRect().top <= 0;
inOverlayPhase = scrolledPx > scrubEnd && !reachedLastSection;
```

```js
// Add or remove a class on <html> based on that
$: document.documentElement.classList.toggle('snap-overlay', inOverlayPhase);
```

```css
/* Snap is only active when the class is present */
:global(html.snap-overlay) {
	scroll-snap-type: y mandatory;
}
```

Notice that `inOverlayPhase` becomes `true` only when **both** conditions hold:

- The user has scrolled past the end of the scrub (`scrolledPx > scrubEnd`)
- The user has _not yet_ reached the last panel (`!reachedLastSection`)

That second condition is critical. If we'd left it out, here's what would happen: the user reaches the last panel, scrolls forward to leave the component… and gets yanked backward. With mandatory snap on and no more panels ahead to snap to, the browser snaps them back to the last panel they were on. They'd be stuck.

> **Takeaway #1 — Mandatory snap needs a clear "off" condition, not just an "on" condition.** Think of it as "snap is on _between_ these two events," not just "snap is on _after_ this event."
>
> **Takeaway #2 — Don't enable mandatory snap on the whole page.** Only turn it on for the part of the journey where you actually want snap behavior. The video scrub needs free scrolling; the panel walk needs strict snapping. Toggle it.

### 3. A tiny smooth-scroll nudge when entering the panel phase

Here's a sneaky browser behavior: when CSS scroll-snap turns from `none` to `mandatory` partway through a scroll gesture, **the browser doesn't go back and snap retroactively.** The browser commits to a snap behavior at the _start_ of a gesture; if scroll-snap was off when the user kicked off their scroll, the browser finishes that gesture without snapping — even if scroll-snap turns on halfway through. Snap won't kick in until the _next_ scroll gesture.

In our case, that means the user finishes the scrub, expects the first panel to snap into place, but instead they have to scroll a second time before snap engages. It feels like the page is ignoring them.

We fix it by doing the snap ourselves. The moment the user crosses out of the scrub phase, we tell the browser to smoothly scroll into the first panel:

```js
// "forwardCrossing" is true on the single frame where the user just
// crossed from scrub-territory into panel-territory.
const forwardCrossing = scrolledPx > scrubEnd && lastScrolledPx <= scrubEnd;
if (forwardCrossing && sectionRefs[0]) {
	sectionRefs[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
}
lastScrolledPx = scrolledPx;
```

`lastScrolledPx` remembers where the user was _last_ time the function ran. By comparing the current position to the last one, we can detect the exact moment they crossed the boundary — and only fire the smooth-scroll once, on that crossing edge. Without it, we'd fire the smooth-scroll every frame the user was past `scrubEnd`, which would constantly fight whatever else they were trying to do.

By the time the smooth-scroll finishes (a few hundred milliseconds later), the user is parked exactly at the first panel's snap point, and mandatory snap is already on. From there, every gesture commits cleanly to the next panel.

> **Takeaway:** CSS scroll-snap properties only affect _future_ scroll gestures, not ones already in flight. When you need an immediate response to a state change, don't wait for the browser — do the scrolling yourself with `scrollIntoView` or `scrollTo`.

### 4. The first panel fades in over the video

This one needs a bit of setup. `position: sticky` has a quirk: an element can only stay "stuck" while there's still room for it inside its parent. As soon as the parent's bottom edge approaches, the sticky element unsticks and slides off with the parent.

That means a sticky element needs a **runway** — its parent has to be at least one viewport taller than the sticky itself. Our scrubber's height is therefore `scrubDistance + 1 viewport`. That trailing viewport at the bottom is the runway: the space the sticky video uses to gracefully slide off the screen.

Here's the problem the original code didn't have, but our refactor created: in the original, that trailing viewport was _full of overlay panels fading in over the video_ — it was meaningful scroll. In the refactor, with the panels now being real sections after the scrubber, that trailing viewport became _empty scroll_. The user would finish the scrub and then have to drag through a blank viewport-worth of nothing before the first section's top arrived.

The current code fills that runway with the first panel — but in a special way. Instead of being a real section like the others, the first panel sits inside `.sticky`, on top of the video, and its **opacity is computed from the scroll position directly**:

```js
// Fade-in starts FIRST_OVERLAY_FADE_RANGE pixels before scrub-end,
// and reaches full opacity exactly at scrub-end.
const fadeStart = scrubEnd - FIRST_OVERLAY_FADE_RANGE;
firstOverlayOpacity = clamp((scrolledPx - fadeStart) / FIRST_OVERLAY_FADE_RANGE, 0, 1);
```

```html
<div class="first-overlay" style="opacity: {firstOverlayOpacity};">
	<!-- the panel's image and text -->
</div>
```

```css
.first-overlay {
	position: absolute;
	inset: 0; /* fills the entire .sticky */
	background: white; /* hides the video underneath as opacity rises */
	z-index: 1; /* sits above the video */
}
```

A few things to notice:

- The opacity is calculated **every frame** based on the user's scroll position. If they scroll back up, the opacity goes back down. The fade is fully reversible.
- The panel reaches full opacity _exactly_ when the scrub finishes. So at the moment the video stops scrubbing, the first panel is fully visible, completely covering the video.
- The white background is what hides the video as the panel fades in. Without it, the panel content (text + image) would fade in but you'd still see the video behind it, which we don't want.

Why **scroll-driven** opacity instead of a regular CSS fade? Because regular CSS transitions have their own clock — `transition: opacity 0.6s ease` means "take 600 milliseconds to fade." If the user scrolls really fast, the panel fades in over 600ms regardless of where they are in the scroll. With scroll-driven opacity, the user _is_ the clock — going forward fades in, going back fades out, and they can pause anywhere in between.

> **Takeaway #1 — A sticky element's runway is part of its layout, not waste.** If you need an element to fully unstick by the end, its parent has to be taller than it by at least one viewport. You can't get rid of that runway, but you can put something meaningful inside it.
>
> **Takeaway #2 — Use scroll-driven values when something needs to track scroll.** CSS transitions run on their own timer; scroll-driven opacity (or position, or rotation, etc.) is locked to the scroll position the user controls.

---

## Side-by-side summary

| Concern                              | Original code                                                                                               | Current code                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Snap targets                         | Tiny invisible divs at calculated `top` values, hidden inside `.sticky` (clipped + wrong coordinate system) | Real `<section>` elements with `scroll-snap-align: start` directly on them                       |
| Snap mode                            | `proximity` (too forgiving for far-apart targets)                                                           | `mandatory` (strict), toggled via a class on `<html>`                                            |
| When snap is active                  | After scrub-end, forever (user got trapped on the last panel)                                               | Only between scrub-end and the last panel reaching the top of the viewport                       |
| Transitioning _into_ the snap region | Relied on the browser to retroactively snap (it doesn't)                                                    | Manual `scrollIntoView({ behavior: 'smooth' })` on the exact frame the user crosses the boundary |
| Where the panels live                | All stacked inside `.sticky`, fading in/out based on scroll progress                                        | First one over the video (scroll-driven fade); the rest are normal sections after the scrubber   |
| Trailing viewport of the scrubber    | Filled by panels fading in over the video                                                                   | First panel fades in here; doubles as runway for the sticky video to unstick                     |
