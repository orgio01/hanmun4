import { apiJson }   from "./api.js";
import { getCartId } from "./storage.js";
import { updateCartBadge, showToast, initSearchNav } from "./common.js";

// ── Category metadata ─────────────────────────────────────────────────────
const META = {
  electronics: { label: "Цахилгаан бараа",          icon: "⚡" },
  fashion:     { label: "Хувцас / Гутал / Аксессуар", icon: "👗" },
  beauty:      { label: "Гоо сайхан",                icon: "💄" },
  home:        { label: "Гэр, Ахуй",                  icon: "🏠" },
  sports:      { label: "Спорт / Чөлөөт цаг",         icon: "⚽" },
  baby:        { label: "Ээж, хүүхэд",               icon: "👶" },
  food:        { label: "Хүнс",                       icon: "🛒" },
  auto:        { label: "Авто хэрэгсэл",              icon: "🚗" },
  books:       { label: "Ном / Хөгжим",               icon: "📚" },
  pets:        { label: "Амьтны хэрэгсэл",            icon: "🐾" },
  health:      { label: "Эрүүл мэнд",                 icon: "💊" },
  travel:      { label: "Аялал",                      icon: "✈️"  },
};

const fmt = (v) => `$${Number(v).toFixed(2)}`;

// ── Get category from URL /category/:name ─────────────────────────────────
function getCategory() {
  const m = window.location.pathname.match(/^\/category\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : "";
}

// ── Fetch: Firebase → local API fallback ──────────────────────────────────
async function fetchProducts(category) {
  try {
    const { fetchProductsByCategory } = await import("./firebase.js");
    return await fetchProductsByCategory(category);
  } catch {
    const data = await apiJson(`/api/products?category=${encodeURIComponent(category)}`);
    return data.items || [];
  }
}

// ── Sorting ───────────────────────────────────────────────────────────────
const SORTS = {
  default:    (a, b) => a.name.localeCompare(b.name, "mn"),
  "price-asc":  (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  discount:   (a, b) => {
    const pctA = a.priceWas ? (a.priceWas - a.price) / a.priceWas : 0;
    const pctB = b.priceWas ? (b.priceWas - b.price) / b.priceWas : 0;
    return pctB - pctA;
  },
};

// ── Product card ──────────────────────────────────────────────────────────
function createCard(p) {
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.productId = p.id;

  const priceWas = p.priceWas && p.priceWas > p.price ? fmt(p.priceWas) : null;
  const pct = p.priceWas && p.priceWas > p.price
    ? Math.round(((p.priceWas - p.price) / p.priceWas) * 100) : null;

  el.innerHTML = `
    <a class="card__imgLink" href="/product/${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true">
      <div class="card__imgWrap">
        <img class="card__img" src="${p.imageUrl}" alt="${p.name}" loading="lazy" />
        ${pct ? `<span class="pill card__imgBadge pill--accent">-${pct}%</span>` : ""}
      </div>
    </a>
    <div class="card__body">
      <h3 class="card__title">
        <a class="card__titleLink" href="/product/${encodeURIComponent(p.id)}">${p.name}</a>
      </h3>
      <div class="card__price">
        <div class="price">
          <span class="price__now">${fmt(p.price)}</span>
          ${priceWas ? `<span class="price__was">${priceWas}</span>` : ""}
          ${pct ? `<span class="price__off">-${pct}%</span>` : ""}
        </div>
      </div>
      <div class="card__cta">
        <button class="mini-btn mini-btn--primary" type="button" data-add-to-cart>
          Сагсанд нэмэх
        </button>
        <a class="link" href="/product/${encodeURIComponent(p.id)}">Үзэх</a>
      </div>
    </div>
  `.trim();

  return el;
}

// ── Render grid ───────────────────────────────────────────────────────────
function renderGrid(products, sortKey) {
  const grid = document.querySelector("[data-cat-grid]");
  if (!grid) return;
  const sorted = [...products].sort(SORTS[sortKey] || SORTS.default);
  grid.replaceChildren(...sorted.map(createCard));
}

// ── Add-to-cart ───────────────────────────────────────────────────────────
function wireCart() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add-to-cart]");
    if (!btn) return;
    const card      = btn.closest(".card");
    const productId = card?.dataset?.productId;
    if (!productId) return;

    btn.textContent = "Нэмж байна…";
    btn.disabled    = true;
    try {
      await apiJson("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ cartId: getCartId(), productId, qty: 1 }),
      });
      btn.textContent = "Нэмлээ ✓";
      showToast("Сагсанд нэмлээ", "ok");
      updateCartBadge();
    } catch (err) {
      btn.textContent = "Дахин оролдох";
      showToast(err?.message || "Алдаа гарлаа", "warn");
    } finally {
      setTimeout(() => { btn.textContent = "Сагсанд нэмэх"; btn.disabled = false; }, 900);
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  initSearchNav();
  updateCartBadge();
  wireCart();

  const category = getCategory();
  if (!category) { window.location.href = "/"; return; }

  const key  = category.toLowerCase();
  const meta = META[key] || { label: category, icon: "🏷" };

  // Set titles
  document.title = `${meta.label} — HANMUN`;
  const setText = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };
  setText("[data-cat-name]",  meta.label);
  setText("[data-cat-title]", meta.label);
  setText("[data-cat-icon]",  meta.icon);

  const grid    = document.querySelector("[data-cat-grid]");
  const empty   = document.querySelector("[data-cat-empty]");
  const countEl = document.querySelector("[data-cat-count]");

  let products = [];

  try {
    products = await fetchProducts(category);
  } catch (err) {
    if (grid) grid.innerHTML = `<p class="catPage__errorMsg">Бараа ачаалж чадсангүй.</p>`;
    return;
  }

  if (!products.length) {
    if (grid)    grid.innerHTML = "";
    if (empty)   empty.hidden = false;
    if (countEl) countEl.textContent = "0 бараа";
    return;
  }

  if (countEl) countEl.textContent = `${products.length} бараа`;
  renderGrid(products, "default");

  // Sort buttons
  let activeSort = "default";
  document.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-sort]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeSort = btn.dataset.sort;
      renderGrid(products, activeSort);
    });
  });
}

main();
