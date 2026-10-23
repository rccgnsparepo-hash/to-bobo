// LEGACY SHIM. Kept only so any lingering import compiles; the real native push
// architecture lives in `src/lib/native/*` and is wired through AppShell.
// Do NOT add logic here — new code should call `initOneSignal` / `loginPushUser`.
import { initOneSignal, loginPushUser } from "./native/onesignal";

export async function initNativePush(userId: string) {
  await initOneSignal();
  if (userId) await loginPushUser(userId);
}