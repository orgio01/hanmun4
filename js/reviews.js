/**
 * Product reviews component.
 * Usage: initReviews(productId, containerEl, currentUserUid | null)
 */

import { fetchReviews, addReview, deleteReview, FIREBASE_READY } from "./firebase.js";
import { showToast } from "./common.js";

const ADMIN_EMAIL = "blackzebra617@gmail.com";

function stars(rating, interactive = false, name = "") {
  return Array.from({ length: 5 }, (_, i) => {
    const val = i + 1;
    if (interactive) {
      return `<label class="reviewStar reviewStar--input" title="${val} одтой">
        <input type="radio" name="${name}" value="${val}" required/>
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </label>`;
    }
    const filled = val <= Math.round(rating);
    return `<svg class="reviewStar ${filled ? "reviewStar--filled" : ""}" viewBox="0 0 24 24" width="16" height="16">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`;
  }).join("");
}

function avgRating(reviews) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

function buildSummary(reviews) {
  const avg = avgRating(reviews);
  const counts = [5,4,3,2,1].map(n => ({
    n, count: reviews.filter(r => r.rating === n).length,
    pct: reviews.length ? Math.round(reviews.filter(r => r.rating === n).length / reviews.length * 100) : 0,
  }));
  return `
    <div class="reviewSummary">
      <div class="reviewSummary__score">
        <div class="reviewSummary__avg">${avg.toFixed(1)}</div>
        <div class="reviewSummary__stars">${stars(avg)}</div>
        <div class="reviewSummary__total">${reviews.length} үнэлгээ</div>
      </div>
      <div class="reviewSummary__bars">
        ${counts.map(c => `
          <div class="reviewSummary__bar">
            <span class="reviewSummary__barLabel">${c.n}★</span>
            <div class="reviewSummary__barTrack">
              <div class="reviewSummary__barFill" style="width:${c.pct}%"></div>
            </div>
            <span class="reviewSummary__barCount">${c.count}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

function buildCard(r, currentUid, isAdmin) {
  const canDelete = isAdmin || r.uid === currentUid;
  return `
    <div class="reviewCard" data-review-uid="${r.uid}">
      <div class="reviewCard__head">
        <div class="reviewCard__user">
          <div class="reviewCard__avatar">${(r.name||"?")[0].toUpperCase()}</div>
          <div>
            <div class="reviewCard__name">${r.name || "Хэрэглэгч"}</div>
            <div class="reviewCard__date">${(r.createdAt||"").slice(0,10)}</div>
          </div>
        </div>
        <div class="reviewCard__stars">${stars(r.rating)}</div>
      </div>
      ${r.text ? `<p class="reviewCard__text">${r.text}</p>` : ""}
      ${canDelete ? `<button class="reviewCard__del" type="button" data-del-review="${r.uid}" title="Устгах">🗑</button>` : ""}
    </div>`;
}

function buildForm(hasReviewed) {
  if (hasReviewed) return `<p class="reviewForm__done">✓ Та аль хэдийн үнэлгээ өгсөн байна.</p>`;
  return `
    <form class="reviewForm" data-review-form>
      <div class="reviewForm__starRow" role="radiogroup" aria-label="Одны үнэлгээ">
        ${stars(0, true, "rating")}
      </div>
      <textarea class="reviewForm__text" name="text" rows="3" maxlength="500"
        placeholder="Таны сэтгэгдэл… (заавал биш)"></textarea>
      <div class="reviewForm__error" data-review-error hidden></div>
      <button class="reviewForm__btn" type="submit">Үнэлгээ илгээх</button>
    </form>`;
}

export async function initReviews(productId, container, currentUser) {
  if (!container) return;
  container.innerHTML = `<div class="reviewSection__loading">Үнэлгээ ачаалж байна…</div>`;

  if (!FIREBASE_READY) {
    container.innerHTML = `<p class="reviewSection__note">Firebase тохируулагдаагүй байна.</p>`;
    return;
  }

  let reviews = [];
  try { reviews = await fetchReviews(productId); } catch {}

  const uid      = currentUser?.uid || null;
  const isAdmin  = currentUser?.email === ADMIN_EMAIL;
  const hasOwn   = reviews.some(r => r.uid === uid);

  container.innerHTML = `
    <div class="reviewSection">
      <h2 class="reviewSection__title">Үнэлгээ & Сэтгэгдэл</h2>
      ${reviews.length ? buildSummary(reviews) : ""}
      <div class="reviewSection__addTitle">${uid ? "Үнэлгээ өгөх" : "Үнэлгээ өгөхийн тулд нэвтэрнэ үү"}</div>
      ${uid ? buildForm(hasOwn) : `<a class="reviewForm__loginBtn" href="/profile.html?mode=login">Нэвтрэх →</a>`}
      <div class="reviewList" data-review-list>
        ${reviews.length
          ? reviews.map(r => buildCard(r, uid, isAdmin)).join("")
          : `<p class="reviewList__empty">Одоогоор үнэлгээ байхгүй. Та эхэлж үнэлгээ өгнө үү!</p>`}
      </div>
    </div>`;

  // Submit review
  container.querySelector("[data-review-form]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form   = e.target;
    const rating = form.querySelector("input[name=rating]:checked")?.value;
    const text   = form.querySelector("[name=text]")?.value || "";
    const errEl  = form.querySelector("[data-review-error]");
    const btn    = form.querySelector("[type=submit]");

    if (!rating) { errEl.textContent = "Одны үнэлгээ сонгоно уу."; errEl.hidden = false; return; }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = "Илгээж байна…";

    try {
      await addReview(productId, uid, {
        rating: Number(rating), text,
        name: currentUser.displayName || "Хэрэглэгч",
      });
      showToast("Үнэлгээ амжилттай илгээгдлээ!", "ok");
      initReviews(productId, container, currentUser); // re-render
    } catch (err) {
      errEl.textContent = err.message; errEl.hidden = false;
      btn.disabled = false; btn.textContent = "Үнэлгээ илгээх";
    }
  });

  // Delete review
  container.addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-del-review]");
    if (!delBtn) return;
    if (!confirm("Үнэлгээг устгах уу?")) return;
    try {
      await deleteReview(productId, delBtn.dataset.delReview);
      showToast("Үнэлгээ устгагдлаа");
      initReviews(productId, container, currentUser);
    } catch (err) { showToast(err.message, "warn"); }
  });

  // Star hover interaction
  const starInputs = container.querySelectorAll(".reviewStar--input input");
  starInputs.forEach((inp, i) => {
    inp.addEventListener("change", () => {
      starInputs.forEach((s, j) => {
        s.closest(".reviewStar--input")?.classList.toggle("is-selected", j <= i);
      });
    });
  });
}
