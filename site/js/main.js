/* ==========================================================================
   Novex Pest Control — site behaviour
   - WhatsApp deep-link builder (single business number: 054 1383 916)
   - Quote form → redirect visitor's details into a pre-filled WhatsApp chat
   - Automatic review system (submit → instantly published to the page)
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Config ---------------- */
  var WA_NUMBER = "971541383916"; // 054 1383 916 (Abu Dhabi) from the business card
  var STORAGE_REVIEWS = "novex_reviews_v1";
  var STORAGE_LEADS = "novex_leads_v1";

  function waLink(text) {
    return "https://wa.me/" + WA_NUMBER + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------------- Toast ---------------- */
  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#ui-check"></use></svg><span></span>';
    toastEl.querySelector("span").textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3600);
  }

  /* ---------------- Safe scroll (never block the WhatsApp redirect) ---------------- */
  function scrollTo(el, opts) {
    if (el && typeof el.scrollIntoView === "function") {
      try { el.scrollIntoView(opts); } catch (e) { /* environment without smooth scroll */ }
    }
  }

  /* ---------------- Header shadow + mobile nav ---------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    window.addEventListener("scroll", function () {
      header.classList.toggle("scrolled", window.scrollY > 8);
    }, { passive: true });
  }

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  var overlay = document.createElement("div");
  overlay.className = "nav-overlay";
  document.body.appendChild(overlay);
  function closeNav() {
    if (nav) nav.classList.remove("open");
    overlay.classList.remove("show");
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      overlay.classList.toggle("show", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    overlay.addEventListener("click", closeNav);
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- Auto-fill any [data-wa] links ---------------- */
  document.querySelectorAll("[data-wa]").forEach(function (el) {
    el.setAttribute("href", waLink(el.getAttribute("data-wa") || ""));
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });

  /* ---------------- Reviews: storage ---------------- */
  function loadReviews() {
    try {
      var raw = localStorage.getItem(STORAGE_REVIEWS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveReviews(list) {
    try { localStorage.setItem(STORAGE_REVIEWS, JSON.stringify(list)); } catch (e) { /* storage full/blocked */ }
  }
  function addReview(review) {
    var list = loadReviews();
    list.unshift(review);
    if (list.length > 200) list.length = 200;
    saveReviews(list);
    return list;
  }

  function starsHtml(n, size) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<svg class="icon' + (i <= n ? "" : " off") + '" aria-hidden="true"><use href="assets/icons.svg#ui-star"></use></svg>';
    }
    return '<div class="stars"' + (size ? ' style="--s:' + size + '"' : "") + ' aria-label="' + n + ' out of 5 stars">' + out + "</div>";
  }

  function initialsOf(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    return ((parts[0] || "?")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function reviewCardHtml(r, fresh) {
    var d = new Date(r.date);
    var when = isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    return (
      '<article class="review-card">' +
        '<span class="review-badge' + (fresh ? " fresh" : "") + '">' + (fresh ? "Just published" : "Verified customer") + "</span>" +
        starsHtml(r.rating) +
        "<blockquote>“" + esc(r.text) + "”</blockquote>" +
        '<div class="review-who">' +
          '<div class="avatar">' + esc(initialsOf(r.name)) + "</div>" +
          "<div>" +
            '<div class="who-name">' + esc(r.name) + "</div>" +
            '<div class="who-meta">' + esc(r.service || "Pest control") + (r.area ? " · " + esc(r.area) : "") + (when ? " · " + when : "") + "</div>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  /* ---------------- Reviews page wiring ---------------- */
  var reviewsList = document.getElementById("reviews-list");
  if (reviewsList) {
    var seed = [];
    try {
      seed = window.NOVEX_SEED_REVIEWS || [];
    } catch (e) { seed = []; }

    function renderReviews(highlightFirst) {
      var stored = loadReviews();
      var all = stored.concat(seed);
      reviewsList.innerHTML = "";
      all.slice(0, 24).forEach(function (r, i) {
        var wrap = document.createElement("div");
        wrap.innerHTML = reviewCardHtml(r, highlightFirst && i === 0 && r.fresh === true);
        reviewsList.appendChild(wrap.firstChild);
      });
      updateSummary(all);
      var empty = document.getElementById("reviews-empty");
      if (empty) empty.hidden = all.length > 0;
    }

    function updateSummary(all) {
      var scoreEl = document.getElementById("rating-score");
      var countEl = document.getElementById("rating-count");
      if (!scoreEl || !countEl) return;
      var total = all.length;
      if (!total) { scoreEl.textContent = "—"; countEl.textContent = "No reviews yet — be the first"; return; }
      var sum = all.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
      scoreEl.textContent = (sum / total).toFixed(1);
      countEl.textContent = total + " review" + (total === 1 ? "" : "s") + " from Abu Dhabi & Al Ain customers";
      for (var s = 5; s >= 1; s--) {
        var bar = document.querySelector('.rating-bars .bar[data-star="' + s + '"]');
        var num = document.querySelector('.rating-bars [data-count="' + s + '"]');
        if (!bar) continue;
        var c = all.filter(function (r) { return Number(r.rating) === s; }).length;
        bar.style.width = total ? Math.round((c / total) * 100) + "%" : "0%";
        if (num) num.textContent = c;
      }
    }

    renderReviews(false);
    window.__novexRenderReviews = renderReviews;

    /* Star input */
    var starInput = document.getElementById("star-input");
    var ratingField = document.getElementById("review-rating");
    if (starInput && ratingField) {
      var btns = starInput.querySelectorAll("button");
      function paint(n) {
        btns.forEach(function (b, i) { b.classList.toggle("on", i < n); });
      }
      btns.forEach(function (b, i) {
        b.addEventListener("click", function () {
          ratingField.value = String(i + 1);
          paint(i + 1);
        });
        b.addEventListener("mouseenter", function () { paint(i + 1); });
        b.addEventListener("mouseleave", function () { paint(Number(ratingField.value) || 0); });
      });
    }

    /* Review form → auto-publish */
    var reviewForm = document.getElementById("review-form");
    if (reviewForm) {
      reviewForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (reviewForm.checkValidity && !reviewForm.checkValidity()) {
          reviewForm.reportValidity();
          return;
        }
        var fd = new FormData(reviewForm);
        var rating = Number(fd.get("rating")) || 0;
        if (!rating) { toast("Please choose a star rating first"); return; }
        var review = {
          name: String(fd.get("name") || "Anonymous").trim() || "Anonymous",
          area: String(fd.get("area") || "").trim(),
          service: String(fd.get("service") || "").trim(),
          rating: rating,
          text: String(fd.get("text") || "").trim(),
          date: new Date().toISOString(),
          fresh: true
        };
        if (!review.text) { toast("Please write a short comment"); return; }
        addReview(review);
        renderReviews(true);
        reviewForm.reset();
        if (ratingField) ratingField.value = "";
        var paintBtns = starInput ? starInput.querySelectorAll("button") : [];
        paintBtns.forEach(function (b) { b.classList.remove("on"); });
        toast("Thank you! Your review is now live on this page.");
        scrollTo(document.getElementById("reviews-list"), { behavior: "smooth", block: "start" });
      });
    }
  }

  /* ---------------- Quote form → WhatsApp redirect ---------------- */
  var quoteForm = document.getElementById("quote-form");
  if (quoteForm) {
    /* Pre-select service if linked from services page (?service=...) */
    try {
      var params = new URLSearchParams(window.location.search);
      var pre = params.get("service");
      if (pre) {
        var sel = quoteForm.querySelector('[name="service"]');
        if (sel) {
          Array.prototype.some.call(sel.options, function (o) {
            if (o.value.toLowerCase() === pre.toLowerCase() || o.text.toLowerCase() === pre.toLowerCase()) {
              sel.value = o.value;
              return true;
            }
            return false;
          });
        }
        var pkg = params.get("package");
        var msgEl = quoteForm.querySelector('[name="message"]');
        if (pkg && msgEl && !msgEl.value) msgEl.value = "Interested in: " + pkg;
      }
    } catch (e) { /* no URL params support */ }

    quoteForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (quoteForm.checkValidity && !quoteForm.checkValidity()) {
        quoteForm.reportValidity();
        return;
      }
      var fd = new FormData(quoteForm);
      function v(k) { return String(fd.get(k) || "").trim(); }

      var ref = "NVX-" + Date.now().toString(36).toUpperCase().slice(-6);
      var lead = {
        ref: ref,
        name: v("name"),
        phone: v("phone"),
        email: v("email"),
        area: v("area"),
        property: v("property"),
        service: v("service"),
        timing: v("timing"),
        message: v("message"),
        date: new Date().toISOString()
      };

      /* Persist the lead locally (site owner can also receive it on WhatsApp) */
      try {
        var leads = JSON.parse(localStorage.getItem(STORAGE_LEADS) || "[]");
        leads.unshift(lead);
        localStorage.setItem(STORAGE_LEADS, JSON.stringify(leads.slice(0, 100)));
      } catch (err) { /* ignore */ }

      var lines = [
        "*NEW QUOTE REQUEST — Novex Pest Control*",
        "Ref: " + ref,
        "",
        "Name: " + lead.name,
        "Phone (WhatsApp): " + lead.phone,
        lead.email ? "Email: " + lead.email : null,
        "Area / Emirate: " + lead.area,
        "Property type: " + lead.property,
        "Service needed: " + lead.service,
        lead.timing ? "Preferred timing: " + lead.timing : null,
        lead.message ? "Details: " + lead.message : null,
        "",
        "_Sent from novexpestcountrol.com_"
      ].filter(Boolean);

      /* Show confirmation panel on the page */
      var panel = document.getElementById("quote-success");
      if (panel) {
        var refEl = panel.querySelector("[data-ref]");
        if (refEl) refEl.textContent = "Reference: " + ref;
        panel.hidden = false;
        var formCard = document.getElementById("quote-card");
        if (formCard) formCard.hidden = true;
        scrollTo(panel, { behavior: "smooth", block: "center" });
      }

      /* Redirect the visitor's entered details into WhatsApp chat */
      var url = waLink(lines.join("\n"));
      window.open(url, "_blank", "noopener");
      toast("Opening WhatsApp with your details pre-filled…");
    });
  }

  /* WhatsApp retry button inside success panel */
  var retryBtns = document.querySelectorAll("[data-wa-retry]");
  retryBtns.forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var lastLead = null;
      try { lastLead = JSON.parse(localStorage.getItem(STORAGE_LEADS) || "[]")[0]; } catch (err) { /* ignore */ }
      if (lastLead) {
        window.open(waLink(
          "*QUOTE REQUEST — Novex Pest Control*\nRef: " + lastLead.ref + "\nName: " + lastLead.name +
          "\nPhone: " + lastLead.phone + "\nArea: " + lastLead.area + "\nProperty: " + lastLead.property +
          "\nService: " + lastLead.service + (lastLead.message ? "\nDetails: " + lastLead.message : "")
        ), "_blank", "noopener");
      } else {
        window.open(waLink("Hello Novex, I'd like a free pest control quote."), "_blank", "noopener");
      }
    });
  });

  /* ---------------- Footer year ---------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
