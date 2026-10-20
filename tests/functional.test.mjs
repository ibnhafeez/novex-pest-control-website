/* Functional test of the Novex site behaviour using jsdom against the real pages.
   jsdom is installed at /tmp/novex-test (scratch dir, kept out of the site folder). */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/tmp/novex-test/package.json");
const { JSDOM } = require("jsdom");

const SITE = "/workspace/chats/efc50999c1ea4588c1ef4740/site";
const JS_SRC = readFileSync(join(SITE, "js/main.js"), "utf8");

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log("  PASS", label); }
  else { fail++; console.log("  FAIL", label); }
}

function loadPage(page, { url = "http://localhost/", query = "", seedStore = null } = {}) {
  const html = readFileSync(join(SITE, page), "utf8");
  const dom = new JSDOM(html, {
    url: url + query,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.__opened = [];
  window.open = (u) => { window.__opened.push(String(u)); return null; };
  window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  if (typeof window.Element.prototype.scrollIntoView !== "function") {
    window.Element.prototype.scrollIntoView = function () {};
  }
  /* simulate a page reload carrying prior storage over */
  if (seedStore) {
    for (const [k, v] of Object.entries(seedStore)) window.localStorage.setItem(k, v);
  }
  /* run the page's inline scripts (seed reviews etc.) first, like a browser would */
  for (const s of [...window.document.querySelectorAll("script:not([src])")]) {
    window.eval(s.textContent);
  }
  window.eval(JS_SRC);
  return window;
}

function storeSnapshot(window) {
  const out = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    out[k] = window.localStorage.getItem(k);
  }
  return out;
}

/* ============ Test 1: WhatsApp links on every page ============ */
console.log("\n[1] WhatsApp deep links (data-wa) on every page:");
for (const page of ["index.html", "services.html", "hygiene.html", "reviews.html", "contact.html"]) {
  const w = loadPage(page);
  const links = [...w.document.querySelectorAll("[data-wa]")];
  ok(links.length >= 3, `${page}: has ${links.length} WhatsApp links`);
  ok(links.every(a => a.href.startsWith("https://wa.me/971541383916")), `${page}: all wa.me links use 971541383916`);
  ok(links.every(a => a.getAttribute("target") === "_blank"), `${page}: wa links open in new tab`);
  const float = w.document.querySelector(".wa-float");
  ok(!!float && float.href.startsWith("https://wa.me/971541383916"), `${page}: floating button wired`);
}

/* ============ Test 2: Quote form → WhatsApp redirect with visitor details ============ */
console.log("\n[2] Quote form redirects visitor details to WhatsApp:");
{
  const w = loadPage("contact.html");
  const d = w.document;
  d.getElementById("q-name").value = "Test Customer";
  d.getElementById("q-phone").value = "0521234567";
  d.getElementById("q-email").value = "test@example.com";
  d.getElementById("q-area").value = "Khalifa City, Abu Dhabi";
  d.getElementById("q-property").value = "Villa";
  d.getElementById("q-service").value = "Termite Control";
  d.getElementById("q-timing").value = "This week";
  d.getElementById("q-message").value = "Termite damage in wooden cabinet";

  d.getElementById("quote-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

  ok(w.__opened.length === 1, "window.open called once");
  const opened = w.__opened[0] || "";
  ok(opened.startsWith("https://wa.me/971541383916?text="), "opens wa.me/971541383916 with text");
  const msg = decodeURIComponent(opened.split("?text=")[1] || "");
  console.log("  --- WhatsApp message preview ---");
  console.log(msg.split("\n").map(l => "    " + l).join("\n"));
  ok(msg.includes("Test Customer"), "message contains name");
  ok(msg.includes("0521234567"), "message contains phone");
  ok(msg.includes("test@example.com"), "message contains email");
  ok(msg.includes("Khalifa City, Abu Dhabi"), "message contains area");
  ok(msg.includes("Villa"), "message contains property type");
  ok(msg.includes("Termite Control"), "message contains service");
  ok(msg.includes("This week"), "message contains preferred timing");
  ok(msg.includes("Termite damage in wooden cabinet"), "message contains description");
  ok(/Ref: NVX-[A-Z0-9]+/.test(msg), "message contains a reference number");

  const panel = d.getElementById("quote-success");
  ok(panel && !panel.hidden, "success panel shown after submit");
  ok(d.getElementById("quote-card").hidden, "form hidden after submit");
  ok(/NVX-/.test(panel.querySelector("[data-ref]").textContent), "reference displayed on success panel");

  const leads = JSON.parse(w.localStorage.getItem("novex_leads_v1") || "[]");
  ok(leads.length === 1 && leads[0].name === "Test Customer", "lead saved to local storage");

  w.__opened.length = 0;
  d.querySelector("[data-wa-retry]").dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  ok(w.__opened.length === 1 && w.__opened[0].includes("wa.me/971541383916"), "retry button re-opens WhatsApp");
}

/* ============ Test 3: Service pre-selection (?service=) ============ */
console.log("\n[3] Service page 'Get Quote' pre-selects service in contact form:");
{
  const w = loadPage("contact.html", { query: "?service=Bed%20Bug%20Treatment" });
  const sel = w.document.getElementById("q-service");
  ok(sel.value === "Bed Bug Treatment", `?service= pre-selects "${sel.value}"`);
}
{
  const w = loadPage("contact.html", { query: "?service=Building%20%26%20Deep%20Cleaning" });
  const sel = w.document.getElementById("q-service");
  ok(sel.value === "Building & Deep Cleaning", `&-encoded service pre-selects "${sel.value}"`);
}

/* ============ Test 4: Automatic review publishing ============ */
console.log("\n[4] Auto-review system (submit → instantly published):");
{
  const w = loadPage("reviews.html");
  const d = w.document;
  const cards = d.querySelectorAll("#reviews-list .review-card");
  ok(cards.length === 6, `seed reviews rendered (${cards.length})`);
  const score = d.getElementById("rating-score").textContent;
  ok(score === "4.8", `rating summary computed (${score})`);
  ok(d.getElementById("rating-count").textContent.includes("6 reviews"), "review count shown");

  d.getElementById("rv-name").value = "Jamal W.";
  d.getElementById("rv-area").value = "Al Reem, Abu Dhabi";
  d.getElementById("rv-service").value = "Rodent Control";
  d.getElementById("review-rating").value = "4";
  d.getElementById("rv-text").value = "Rats removed quickly, very professional team.";

  d.getElementById("review-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

  const after = d.querySelectorAll("#reviews-list .review-card");
  ok(after.length === 7, `review auto-published instantly (${after.length} cards now)`);
  const first = after[0].textContent;
  ok(first.includes("Jamal W."), "new review appears first in list");
  ok(first.includes("Rats removed quickly"), "new review text published");
  ok(first.includes("Just published"), "new review flagged 'Just published'");
  const saved = JSON.parse(w.localStorage.getItem("novex_reviews_v1") || "[]");
  ok(saved.length === 1 && saved[0].name === "Jamal W.", "review persisted to local storage");
  const newScore = d.getElementById("rating-score").textContent;
  ok(newScore === "4.7", `rating summary recalculated (${newScore})`);
  ok(d.getElementById("rv-text").value === "", "form cleared after publish");

  const w2 = loadPage("reviews.html");
  const btns = w2.document.querySelectorAll("#star-input button");
  btns[2].dispatchEvent(new w2.MouseEvent("click", { bubbles: true }));
  ok(w2.document.getElementById("review-rating").value === "3", "star click sets rating=3");
  ok(btns[0].classList.contains("on") && btns[2].classList.contains("on") && !btns[3].classList.contains("on"), "3 stars visually filled");
}

/* ============ Test 5: Cross-page persistence ============ */
console.log("\n[5] Review persists across page loads:");
{
  const w1 = loadPage("reviews.html");
  w1.document.getElementById("rv-name").value = "Persist Tester";
  w1.document.getElementById("review-rating").value = "5";
  w1.document.getElementById("rv-text").value = "Great hygiene.";
  w1.document.getElementById("review-form").dispatchEvent(new w1.Event("submit", { bubbles: true, cancelable: true }));

  /* fresh window that inherits the same browser storage = a real reload */
  const w2 = loadPage("reviews.html", { seedStore: storeSnapshot(w1) });
  const first = w2.document.querySelector("#reviews-list .review-card");
  ok(first.textContent.includes("Persist Tester"), "review survives a page reload");
  ok(w2.document.getElementById("rating-count").textContent.includes("7 reviews"), "count updated to 7");
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
