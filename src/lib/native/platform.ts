// Single source of truth for "are we running inside a Capacitor native shell?".
// Guards every native-only code path so the web bundle is fully safe.
export function isNativePlatform(): boolean {
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}
