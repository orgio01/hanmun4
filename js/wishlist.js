import { apiJson }                        from "./api.js";
import { getCartId }                      from "./storage.js";
import { getWishlist, toggleWishlist, clearWishlist } from "./storage.js";
import { updateCartBadge, showToast, initSearchNav }  from "./common.js";

const fmt = (v) => `$${Number(v).toFixed(2)}`;

function buildCard(p) {
  const priceWas = p.priceWas && p.priceWas > p.price ? fmt(p.priceWas) : null;
  const pct      = p.priceWas && p.priceWas > p.price
    ? Math.round(((p.priceWas - p.price) / p.priceWas) * 100) : null;

  return `
  <article class="card wishCard" data-product-id="${p.id}">
    <a class="card__imgLink" href="/product/${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true">
      <div class="card__imgWrap">
        <img class="card__img" src="${p.imageUrl}" alt="${p.name}" loading="lazy"/>
        ${pct ? `<span class="pill card__imgBadge pill--accent">-${pct}%</span>` : ""}
      </div>
    </a>
    <button class="wishHeart wishHeart--filled" type="button" data-wish-remove="${p.id}" aria-label="Жагсаалтаас хасах" title="Хасах">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
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
        <button class="mini-btn mini-btn--primary" type="button" data-add-to-cart>Сагсанд нэмэх</button>
        <a class="link" href="/product/${encodeURIComponent(p.id)}">Үзэх</a>
      </div>
    </div>
  </article>`;
}

async function main() {
  initSearchNav();
  updateCartBadge();

  const grid    = document.querySelector("[data-wish-grid]");
  const empty   = document.querySelector("[data-wish-empty]");
  const countEl = document.querySelector("[data-wish-count]");

  const ids = getWishlist();

  if (!ids.length) {
    grid.innerHTML = ""; empty.hidden = false;
    if (countEl) countEl.textContent = "0 бараа";
    return;
  }

  // Fetch products in parallel
  const results = await Promise.allSettled(
    ids.map(id => apiJson(`/api/products/${encodeURIComponent(id)}`))
  );

  const products = results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value)
    .filter(Boolean);

  if (!products.length) {
    grid.innerHTML = ""; empty.hidden = false;
    if (countEl) countEl.textContent = "0 бараа";
    return;
  }

  if (countEl) countEl.textContent = `${products.length} бараа`;
  grid.innerHTML = products.map(buildCard).join("");

  // Remove from wishlist
  grid.addEventListener("click", async (e) => {
    const removeBtn = e.target.closest("[data-wish-remove]");
    if (removeBtn) {
      const id   = removeBtn.dataset.wishRemove;
      const card = removeBtn.closest(".wishCard");
      toggleWishlist(id);
      card.style.opacity = "0";
      card.style.transition = "opacity 200ms ease";
      setTimeout(() => { card.remove(); refreshCount(); }, 200);
      showToast("Жагсаалтаас хаслаа");
      return;
    }

    // Add to cart
    const addBtn = e.target.closest("[data-add-to-cart]");
    if (addBtn) {
      const card      = addBtn.closest(".wishCard");
      const productId = card?.dataset?.productId;
      if (!productId) return;
      addBtn.disabled = true; addBtn.textContent = "Нэмж байна…";
      try {
        await apiJson("/api/cart/items", {
          method: "POST",
          body: JSON.stringify({ cartId: getCartId(), productId, qty: 1 }),
        });
        addBtn.textContent = "Нэмлээ ✓";
        showToast("Сагсанд нэмлээ", "ok");
        updateCartBadge();
      } catch (err) {
        addBtn.textContent = "Дахин оролдох";
        showToast(err.message || "Алдаа", "warn");
      } finally {
        setTimeout(() => { addBtn.textContent = "Сагсанд нэмэх"; addBtn.disabled = false; }, 900);
      }
    }
  });

  // Clear all
  document.querySelector("[data-clear-all]")?.addEventListener("click", () => {
    if (!confirm("Бүх дуртай барааг устгах уу?")) return;
    clearWishlist();
    grid.innerHTML = ""; empty.hidden = false;
    if (countEl) countEl.textContent = "0 бараа";
    showToast("Бүгд устгагдлаа");
  });

  function refreshCount() {
    const remaining = grid.querySelectorAll(".wishCard").length;
    if (countEl) countEl.textContent = `${remaining} бараа`;
    if (!remaining) { empty.hidden = false; }
  }
}

main();
