// Day / Night toggle. An inline script in <head> applies a stored choice before first paint;
// this file wires the masthead button. With no stored choice the site opens in Day.
// The button's label ("Night" or "Day") is switched by CSS, so it never flashes.
// Models read colors from CSS tokens at draw time; a "themechange" event on document lets them redraw at once.
(function () {
  var root = document.documentElement;

  function stored() {
    try { var t = localStorage.getItem("theme"); return t === "dark" || t === "light" ? t : null; } catch (e) { return null; }
  }
  function store(t) {
    try { localStorage.setItem("theme", t); } catch (e) { /* storage blocked: the choice lasts for this page only */ }
  }
  function current() {
    var t = root.getAttribute("data-theme");
    return t === "dark" ? "dark" : "light";
  }
  function syncMeta(t) {
    var color = t === "dark" ? "#050505" : "#fcfcfa";
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute("content", color); });
  }
  function announce(t) {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("title", t === "dark" ? "Switch to day mode" : "Switch to night mode");
    });
    var ev;
    try { ev = new CustomEvent("themechange", { detail: { theme: t } }); } catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("themechange", false, false, { theme: t }); }
    document.dispatchEvent(ev);
  }
  function apply(t, save) {
    root.setAttribute("data-theme", t);
    if (save) store(t);
    syncMeta(t);
    announce(t);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-theme-toggle]") : null;
    if (!btn) return;
    apply(current() === "dark" ? "light" : "dark", true);
  });

  if (stored()) syncMeta(current());
  announce(current());
})();
