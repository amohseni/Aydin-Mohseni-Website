// Site behavior, loaded as an ES module on every page.
// 1. Live models: each <figure class="model" data-model="name"> is mounted when it nears the viewport
//    by importing ./models/<name>.js (resolved next to this file, so a path prefix works) and calling
//    mount(container, options). options come from the JSON in data-model-options.
// 2. Margin notes: on phones, the toggles open notes in place; this adds keyboard access.
// 3. Review mode (#review) highlights every element marked data-verify.
// 4. Filters for lists of works, and Copy buttons for citations.

const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Models ---------- */
const MODELS = new URL("./models/", import.meta.url);

function mountModel(fig) {
  if (fig.dataset.mounted) return;
  const name = fig.dataset.model || "";
  if (!/^[a-z0-9-]+$/.test(name)) { fig.dataset.mounted = "error"; return; }
  fig.dataset.mounted = "pending";
  let options = {};
  try { options = JSON.parse(fig.dataset.modelOptions || "{}"); } catch (e) { options = {}; }
  options.reducedMotion = reduceMotion;
  const container = fig.querySelector(".model-mount") || fig;
  import(new URL(name + ".js", MODELS).href)
    .then((mod) => {
      const fn = typeof mod.mount === "function" ? mod.mount : (mod.default && typeof mod.default.mount === "function" ? mod.default.mount : mod.default);
      if (typeof fn !== "function") throw new Error("Model " + name + " has no mount()");
      container.querySelectorAll(".model-fallback").forEach((n) => n.remove());
      return fn(container, options);
    })
    .then(() => { fig.dataset.mounted = "true"; })
    .catch((err) => {
      fig.dataset.mounted = "error";
      console.error(err);
      if (!container.querySelector(".model-fallback")) {
        const p = document.createElement("p");
        p.className = "model-fallback";
        p.textContent = "This interactive figure could not be loaded.";
        container.appendChild(p);
      }
    });
}

const figures = document.querySelectorAll("[data-model]");
if (figures.length) {
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mountModel(e.target); } });
    }, { rootMargin: "400px 0px" });
    figures.forEach((f) => io.observe(f));
  } else {
    figures.forEach(mountModel);
  }
}

/* ---------- 2. Margin-note toggles ---------- */
document.querySelectorAll("label.margin-toggle").forEach((label) => {
  const input = document.getElementById(label.getAttribute("for"));
  if (!input) return;
  const note = input.nextElementSibling;
  if (note && !note.id) note.id = input.id + "-note";
  label.setAttribute("role", "button");
  label.setAttribute("tabindex", "0");
  if (note) label.setAttribute("aria-controls", note.id);
  if (!label.getAttribute("aria-label")) label.setAttribute("aria-label", label.classList.contains("sidenote-number") ? "Show note" : "Show margin note");
  const sync = () => label.setAttribute("aria-expanded", input.checked ? "true" : "false");
  sync();
  input.addEventListener("change", sync);
  label.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.checked = !input.checked; sync(); }
  });
});
// The toggles only matter on narrow screens; on wide screens the notes sit in the margin.
const narrow = window.matchMedia("(max-width: 860px)");
function syncToggleFocus() {
  document.querySelectorAll("label.margin-toggle").forEach((l) => {
    if (narrow.matches) { l.setAttribute("tabindex", "0"); l.setAttribute("role", "button"); }
    else { l.removeAttribute("tabindex"); l.removeAttribute("role"); l.removeAttribute("aria-expanded"); }
  });
}
syncToggleFocus();
if (narrow.addEventListener) narrow.addEventListener("change", syncToggleFocus);

/* ---------- 3. Review mode ---------- */
(function review() {
  const root = document.documentElement;
  function sync() {
    const on = location.hash === "#review";
    root.classList.toggle("review", on);
    const n = document.querySelectorAll("[data-verify]").length;
    const count = document.getElementById("review-count");
    if (count) count.textContent = n === 1 ? "1 claim to confirm" : n + " claims to confirm";
  }
  window.addEventListener("hashchange", sync);
  sync();
  document.querySelectorAll("[data-verify]").forEach((el) => {
    const note = el.getAttribute("data-verify");
    if (note && !el.title) el.title = "To confirm: " + note;
  });
})();

/* ---------- 4. Filters and citation copy ---------- */
document.querySelectorAll(".filters").forEach((group) => {
  const buttons = group.querySelectorAll("button[data-filter]");
  const scope = group.closest("section, main") || document;
  const key = group.getAttribute("data-filter-key") || "type";
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-filter");
      buttons.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      scope.querySelectorAll(".works .work").forEach((li) => {
        li.hidden = value !== "all" && li.getAttribute("data-" + key) !== value;
      });
    });
  });
});

document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", () => {
    const pre = btn.parentNode.querySelector("pre");
    if (!pre) return;
    const text = pre.textContent;
    const done = (label) => { btn.textContent = label; setTimeout(() => { btn.textContent = "Copy"; }, 1600); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents(pre);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      done("Selected");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done("Copied"), fallback);
    else fallback();
  });
});
