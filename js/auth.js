/**
 * Firebase Authentication wrapper.
 * Import энэ файлыг profile.js болон бусад файлуудаас ашиглана.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  FIREBASE_READY,
  getAuth_,
  saveUserProfile,
  getUserProfile,
} from "./firebase.js";

// ─── Sign up (шинэ хэрэглэгч бүртгэх) ────────────────────────────────────
export async function signUp({ email, password, name, phone, district, addressLine }) {
  if (!FIREBASE_READY) throw new Error("Firebase тохируулагдаагүй байна.");

  const cred = await createUserWithEmailAndPassword(getAuth_(), email, password);

  // Firebase Auth profile дотор нэр хадгал
  await updateProfile(cred.user, { displayName: name });

  // Firestore-д нэмэлт мэдээлэл хадгал
  const profile = {
    name, phone, email,
    district, addressLine,
    createdAt: new Date().toISOString(),
  };
  await saveUserProfile(cred.user.uid, profile);

  return { user: cred.user, profile };
}

// ─── Sign in (нэвтрэх) ────────────────────────────────────────────────────
export async function signIn(email, password) {
  if (!FIREBASE_READY) throw new Error("Firebase тохируулагдаагүй байна.");

  const cred    = await signInWithEmailAndPassword(getAuth_(), email, password);
  const profile = await getUserProfile(cred.user.uid);

  if (profile?.banned) {
    await signOut(getAuth_());
    throw new Error("Таны бүртгэл түр хаагдсан байна. Дэмжлэгтэй холбогдоно уу.");
  }

  return { user: cred.user, profile };
}

// ─── Sign out (гарах) ─────────────────────────────────────────────────────
export async function logOut() {
  if (!FIREBASE_READY) return;
  await signOut(getAuth_());
}

// ─── Auth state listener ──────────────────────────────────────────────────
/** callback(user | null, profile | null) */
export function onAuth(callback) {
  if (!FIREBASE_READY) {
    callback(null, null);
    return () => {};
  }
  return onAuthStateChanged(getAuth_(), async (user) => {
    if (!user) { callback(null, null); return; }
    const profile = await getUserProfile(user.uid).catch(() => null);
    callback(user, profile);
  });
}

// ─── Current user ─────────────────────────────────────────────────────────
export function currentUser() {
  return FIREBASE_READY ? getAuth_().currentUser : null;
}

// ─── Password reset ───────────────────────────────────────────────────────
export async function resetPassword(email) {
  if (!FIREBASE_READY) throw new Error("Firebase тохируулагдаагүй байна.");
  await sendPasswordResetEmail(getAuth_(), email);
}
