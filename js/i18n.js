const KEY = "mvp_lang";

const dict = {
  en: {
    searchPlaceholder: "Search products, brands…",
    fastDelivery: "Fast delivery",
    buyAgain: "Buy again",
    membership: "Membership",
    login: "Log in",
    signup: "Sign up",
  },
  mn: {
    searchPlaceholder: "Бараа, брэнд хайх…",
    fastDelivery: "Хурдан хүргэлт",
    buyAgain: "Дахин авах",
    membership: "Гишүүнчлэл",
    login: "Нэвтрэх",
    signup: "Бүртгүүлэх",
  },
};

export function getLang() {
  return localStorage.getItem(KEY) || "mn";
}

export function setLang(lang) {
  localStorage.setItem(KEY, lang);
}

export function t(key) {
  const lang = getLang();
  return dict[lang]?.[key] ?? dict.en[key] ?? key;
}

export function applyI18n(root = document) {
  const lang = getLang();
  root.documentElement?.setAttribute?.("lang", lang === "mn" ? "mn" : "en");

  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (!k) return;
    el.textContent = t(k);
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (!k) return;
    el.setAttribute("placeholder", t(k));
  });
}

