/** Resolve both Firefox and Chromium APIs without changing browser globals. */
export function extensionApi() {
  return globalThis.browser ?? globalThis.chrome;
}
