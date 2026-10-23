import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

const FIREBASE_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_FIREBASE_API_KEY) ||
  "AIzaSyADKh0TbWPTDe13N1mYF9PCbI-J1FjpMgw";

export const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "gen-lang-client-0982710068.firebaseapp.com",
  projectId: "gen-lang-client-0982710068",
  storageBucket: "gen-lang-client-0982710068.firebasestorage.app",
  messagingSenderId: "894267205842",
  appId: "1:894267205842:android:f37fa6c6c6b92fe82c250b",
};

export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

/**
 * Sends a password reset email using the user's dedicated Firebase project.
 * Uses Firebase Auth SDK with an Identity Toolkit REST API fallback.
 */
export async function sendFirebasePasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail) throw new Error("Please enter a valid email address.");

  try {
    await sendPasswordResetEmail(firebaseAuth, cleanEmail);
    return {
      success: true,
      message: `Firebase password reset link dispatched to ${cleanEmail}. Please check your inbox.`,
    };
  } catch (err: any) {
    // Fallback to Google Identity Toolkit REST API
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email: cleanEmail,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || err.message || "Firebase reset failed");
      }
      return {
        success: true,
        message: `Firebase password reset link dispatched to ${cleanEmail}. Please check your inbox.`,
      };
    } catch (restErr: any) {
      const msg = restErr.message || err.message || "Failed to send reset email";
      if (msg.includes("EMAIL_NOT_FOUND")) {
        throw new Error("No account found with this email in Firebase.");
      }
      throw new Error(msg);
    }
  }
}
