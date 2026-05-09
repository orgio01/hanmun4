import { apiJson } from "./api.js";

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt  = (v) => `$${Number(v).toFixed(2)}`;
const qs   = (sel) => document.querySelector(sel);
const setText = (sel, v) => { const el = qs(sel); if (el) el.textContent = v; };

function getOrderNumber() {
  return new URLSearchParams(window.location.search).get("order") || "";
}

function deliveryDateStr(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  const mn = ["1-р","2-р","3-р","4-р","5-р","6-р","7-р","8-р","9-р","10-р","11-р","12-р"];
  const dn = ["Ням","Даваа","Мягмар","Лхагва","Пүрэв","Баасан","Бямба"];
  return `${mn[d.getMonth()]} сарын ${d.getDate()}, ${dn[d.getDay()]}`;
}

const PAYMENT_LABELS = {
  card: "💳 Карт",
  qpay: "📱 QPay",
  transfer: "💵 Бэлнээр",
};

// ── Confetti ──────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ["#e8232a","#0074e9","#19b37a","#ffbf4a","#9c27b0","#f96d00"];
  const pieces = Array.from({ length: 120 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * -canvas.height * 0.6,
    w:     6 + Math.random() * 8,
    h:     4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx:    (Math.random() - 0.5) * 3,
    vy:    2 + Math.random() * 4,
    rot:   Math.random() * 360,
    vr:    (Math.random() - 0.5) * 8,
    opacity: 1,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of pieces) {
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.vr;
      if (p.y > canvas.height * 0.7) p.opacity -= 0.025;
      if (p.opacity <= 0) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive > 0 && frame < 220) { frame++; requestAnimationFrame(draw); }
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ── Animated entrance ─────────────────────────────────────────────────────
function animateEntrance() {
  // Checkmark animation is CSS-driven
  // Fade in text elements with stagger
  const targets = [
    { sel: "[data-hero-title]", delay: 600 },
    { sel: "[data-hero-hint]",  delay: 800 },
    { sel: "[data-order-num]",  delay: 1000 },
    { sel: "[data-os-body]",    delay: 1200 },
  ];
  for (const { sel, delay } of targets) {
    const el = qs(sel);
    if (!el) continue;
    setTimeout(() => {
      el.style.transition = "opacity 500ms ease, transform 500ms ease";
      el.style.opacity    = "1";
      el.style.transform  = "translateY(0)";
    }, delay);
    el.style.transform = "translateY(12px)";
  }
}

// ── Render order data ─────────────────────────────────────────────────────
function renderItems(items) {
  const box = qs("[data-os-items]");
  if (!box) return;
  box.innerHTML = items.map(i => `
    <div class="osItem">
      <a href="/product/${encodeURIComponent(i.productId)}" class="osItem__imgLink">
        <div class="osItem__imgFallback">${i.name[0]}</div>
      </a>
      <div class="osItem__info">
        <div class="osItem__name">${i.name}</div>
        <div class="osItem__qty">${i.qty} ширхэг × ${fmt(i.price)}</div>
      </div>
      <div class="osItem__total">${fmt(i.price * i.qty)}</div>
    </div>
  `).join("");
}

function renderDelivery(order) {
  const box = qs("[data-os-delivery]");
  if (!box) return;
  const isFast = order.shipment?.eta?.includes("Same") || order.shipment?.eta?.includes("next");
  const days   = isFast ? 1 : 3;
  const eta    = deliveryDateStr(days);
  setText("[data-delivery-eta-step]",  "Өнөөдөр бэлдэж эхэлнэ");
  setText("[data-delivery-date-step]", eta);

  box.innerHTML = `
    <div class="osInfoRow">
      <span class="osInfoRow__label">Хаяг</span>
      <span class="osInfoRow__val">${order.customer?.district || "—"}, ${order.customer?.addressLine || "—"}</span>
    </div>
    <div class="osInfoRow">
      <span class="osInfoRow__label">Хэрэглэгч</span>
      <span class="osInfoRow__val">${order.customer?.name || "—"} • ${order.customer?.phone || "—"}</span>
    </div>
    <div class="osInfoRow">
      <span class="osInfoRow__label">Хүргэлт</span>
      <span class="osInfoRow__val osInfoRow__val--highlight">🚀 ${eta}</span>
    </div>
    ${order.customer?.notes ? `<div class="osInfoRow"><span class="osInfoRow__label">Тэмдэглэл</span><span class="osInfoRow__val">${order.customer.notes}</span></div>` : ""}
  `;
}

function renderPayment(order) {
  const box = qs("[data-os-payment]");
  if (!box) return;
  const methodLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || "—";
  const isPaid = order.paymentStatus === "paid";
  box.innerHTML = `
    <div class="osInfoRow">
      <span class="osInfoRow__label">Хэлбэр</span>
      <span class="osInfoRow__val">${methodLabel}</span>
    </div>
    <div class="osInfoRow">
      <span class="osInfoRow__label">Байдал</span>
      <span class="osInfoRow__val">
        ${isPaid
          ? `<span class="osBadge osBadge--green">✓ Төлсөн</span>`
          : `<span class="osBadge osBadge--orange">⏳ Хүлээгдэж байна</span>`}
      </span>
    </div>
    <div class="osInfoRow">
      <span class="osInfoRow__label">Нийт</span>
      <span class="osInfoRow__val"><strong>${fmt(order.totals?.total || 0)}</strong></span>
    </div>
  `;
}

function renderTotals(order) {
  setText("[data-t-sub]",   fmt(order.totals?.subtotal     || 0));
  setText("[data-t-del]",   fmt(order.totals?.deliveryFee  || 0));
  setText("[data-t-total]", fmt(order.totals?.total        || 0));
}

// ── Copy order number ─────────────────────────────────────────────────────
function initCopyBtn(orderNumber) {
  qs("[data-copy-order]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      const btn = qs("[data-copy-order]");
      if (btn) { btn.innerHTML = "✓"; setTimeout(() => btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`, 1500); }
    } catch {}
  });

  // Track order link
  const trackLink = qs("[data-track-link]");
  if (trackLink) trackLink.href = `/orders.html?order=${encodeURIComponent(orderNumber)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const orderNumber = getOrderNumber();
  if (!orderNumber) { window.location.href = "/"; return; }

  document.title = `Захиалга ${orderNumber} — HANMUN`;
  setText("[data-order-number-display]", orderNumber);

  animateEntrance();
  setTimeout(launchConfetti, 400);
  initCopyBtn(orderNumber);

  try {
    const order = await apiJson(`/api/orders/${encodeURIComponent(orderNumber)}`);
    renderItems(order.items || []);
    renderDelivery(order);
    renderPayment(order);
    renderTotals(order);
  } catch {
    // Server might be off — show basic success state
    qs("[data-os-items]").innerHTML = `<p style="padding:16px;color:rgba(16,16,16,.45);font-size:.88rem">Бараа мэдээлэл ачаалагдсангүй.</p>`;
  }
}

main();
