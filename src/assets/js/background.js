// Page background: the chaos model in background mode, behind all content.
//
// Load it as a module from the base layout:
//   <script type="module" src="{{ '/assets/js/background.js' | url }}"></script>
// The base layout includes it when a page sets `background: chaos`, and provides the fixed
// layer <div class="model-background" data-model-background="chaos">. The canvas fills that
// layer; without one, it is inserted as a fixed canvas at the start of <body>. Page content
// sits above it (.page has position: relative and z-index: 1, as on exproof.ai). The orbit is
// dimmed under the element marked [data-scrim], or under <main> if none is marked. The orbit
// and its trace carry over between pages in the same tab.
//
// Opt out on a page with <body data-background="off">.
import { mount } from "./models/chaos.js";

function start() {
  const body = document.body;
  if (!body || body.dataset.background === "off") return;
  if (document.querySelector("canvas.chaos-background")) return;
  const layer = document.querySelector("[data-model-background]");
  if (layer && layer.dataset.modelBackground && layer.dataset.modelBackground !== "chaos") return;
  try {
    window.__chaosBackground = mount(layer || body, { mode: "background" });
  } catch (e) {
    // A decorative layer must never break the page.
    if (window.console) console.warn("background:", e);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
