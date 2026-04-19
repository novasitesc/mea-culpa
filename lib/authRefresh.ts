export function emitAuthRefresh(oro?: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("auth:refresh", {
      detail: typeof oro === "number" ? { oro } : {},
    }),
  );
}