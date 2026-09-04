export const PREVIEW_ACCESS_COOKIE = "sozamen_preview_access";

const encoder = new TextEncoder();

export function isPreviewAccessEnabled() {
  return Boolean(process.env.PREVIEW_PASSWORD?.trim());
}

export async function createPreviewAccessToken(password: string) {
  const signingSecret = process.env.SESSION_SECRET;
  if (!signingSecret) {
    throw new Error("SESSION_SECRET is required when preview access is enabled.");
  }
  const value = `sozamen-preview:${password}:${signingSecret}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hasValidPreviewAccess(cookieValue?: string) {
  const password = process.env.PREVIEW_PASSWORD?.trim();
  if (!password) return true;
  if (!cookieValue) return false;

  return cookieValue === (await createPreviewAccessToken(password));
}
