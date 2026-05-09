/**
 * ┌─────────────────────────────────────────────────────┐
 *  HANMUN — Firebase Setup
 *
 *  Алхам 1: console.firebase.google.com → Create project
 *  Алхам 2: Authentication → Sign-in method →
 *            Email/Password → Enable
 *  Алхам 3: Firestore Database → Create → Test mode
 *  Алхам 4: Project Settings → Your apps → Web →
 *            Register app → Copy firebaseConfig
 *  Алхам 5: Доорх config-г өөрийн утгаар солино уу
 *  Алхам 6: /scripts/seed-firestore.html хуудсыг
 *            browser-д нээгээд "Seed" дарна
 * └─────────────────────────────────────────────────────┘
 */

import { initializeApp, getApps } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, orderBy, limit,
  serverTimestamp,
} from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ─── Firebase config ──────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey:            "AIzaSyCPiJtQZ0_dCN6ZQy61znv4X1QN1xPYcfs",
  authDomain:        "hangman-79b6a.firebaseapp.com",
  projectId:         "hangman-79b6a",
  storageBucket:     "hangman-79b6a.firebasestorage.app",
  messagingSenderId: "596119763707",
  appId:             "1:596119763707:web:eaaa491058824580ffce5e",
  measurementId:     "G-4DYQMKHY2H",
};

export const FIREBASE_READY = !firebaseConfig.apiKey.startsWith("YOUR_");

// ─── Lazy singletons ──────────────────────────────────────────────────────
let _app, _db, _auth;

export function getFirebaseApp() {
  if (!_app) _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return _app;
}
export function getDb()   { if (!_db)   _db   = getFirestore(getFirebaseApp()); return _db;   }
export function getAuth_() { if (!_auth) _auth  = getAuth(getFirebaseApp());      return _auth; }

// ─── Product helpers ──────────────────────────────────────────────────────
function mapProduct(snap) {
  const d = snap.data();
  return {
    id:          snap.id,
    name:        d.name        ?? "",
    description: d.description ?? "",
    price:       Number(d.price    ?? 0),
    priceWas:    d.priceWas != null ? Number(d.priceWas) : null,
    imageUrl:    d.imageUrl    ?? "",
    category:    d.category    ?? "",
    stockQty:    Number(d.stockQty  ?? 0),
    badge:       d.badge       ?? null,
    badgeTone:   d.badgeTone   ?? null,
    tags:        Array.isArray(d.tags) ? d.tags : [],
  };
}

/** Нэг бараа ID-аар авах */
export async function fetchProductFirebase(id) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const snap = await getDoc(doc(getDb(), "products", id));
  if (!snap.exists()) throw new Error(`Product "${id}" not found`);
  return mapProduct(snap);
}

/** Ангиллаар шүүж авах */
export async function fetchProductsByCategory(category) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const q = query(
    collection(getDb(), "products"),
    where("category", "==", category),
    orderBy("name"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapProduct);
}

/** Бүх бараа авах */
export async function fetchAllProducts() {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const snap = await getDocs(collection(getDb(), "products"));
  return snap.docs.map(mapProduct);
}

// ─── Product CRUD (admin) ────────────────────────────────────────────────
export async function addProduct(data) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const ref = await addDoc(collection(getDb(), "products"), {
    ...data, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateProduct(id, data) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  await updateDoc(doc(getDb(), "products", id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteProduct(id) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  await deleteDoc(doc(getDb(), "products", id));
}

// ─── User profile in Firestore ────────────────────────────────────────────
export async function saveUserProfile(uid, data) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  await setDoc(doc(getDb(), "users", uid),
    { ...data, updatedAt: new Date().toISOString() },
    { merge: true });
}

export async function getUserProfile(uid) {
  if (!FIREBASE_READY) return null;
  const snap = await getDoc(doc(getDb(), "users", uid));
  return snap.exists() ? snap.data() : null;
}

/** Бүх хэрэглэгчдийн жагсаалт (admin) */
export async function fetchAllUsers() {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const snap = await getDocs(collection(getDb(), "users"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ─── Product Image Upload (Firebase Storage) ────────────────────────────
export async function uploadProductImage(file, productId) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const storage  = getStorage(getFirebaseApp());
  const fileRef  = ref(storage, `products/${productId || Date.now()}/${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// ─── Reviews (Firestore subcollection) ──────────────────────────────────
// reviews/{productId}/items/{uid}
export async function fetchReviews(productId) {
  if (!FIREBASE_READY) return [];
  const snap = await getDocs(
    query(collection(getDb(), "reviews", productId, "items"), orderBy("createdAt", "desc"), limit(20))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addReview(productId, uid, { rating, text, name }) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  await setDoc(doc(getDb(), "reviews", productId, "items", uid), {
    rating: Number(rating), text: String(text).trim(), name: String(name).trim(), uid,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteReview(productId, uid) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  await deleteDoc(doc(getDb(), "reviews", productId, "items", uid));
}

// ─── Coupon codes ────────────────────────────────────────────────────────
// Firestore: coupons/{CODE} → { discount, type: "percent"|"fixed", maxUses, usedCount, expiresAt }
export async function validateCoupon(code) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  const snap = await getDoc(doc(getDb(), "coupons", code.toUpperCase().trim()));
  if (!snap.exists()) throw new Error("Купон код олдсонгүй");
  const d = snap.data();
  if (d.expiresAt && new Date(d.expiresAt) < new Date()) throw new Error("Купоны хугацаа дууссан");
  if (d.maxUses > 0 && d.usedCount >= d.maxUses) throw new Error("Купон ашиглагдсан байна");
  return { code: snap.id, discount: d.discount, type: d.type || "percent", description: d.description || "" };
}

export async function incrementCouponUsage(code) {
  if (!FIREBASE_READY) return;
  const ref_ = doc(getDb(), "coupons", code.toUpperCase().trim());
  const snap = await getDoc(ref_);
  if (snap.exists()) {
    await updateDoc(ref_, { usedCount: (snap.data().usedCount || 0) + 1 });
  }
}

/** Хэрэглэгч ban/unban хийх (admin) */
export async function setBanUser(uid, banned) {
  if (!FIREBASE_READY) throw new Error("not-configured");
  await updateDoc(doc(getDb(), "users", uid), {
    banned,
    bannedAt: banned ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
}
