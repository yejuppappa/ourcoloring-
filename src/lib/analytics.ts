/**
 * Analytics event tracking.
 * GA4 and Clarity are loaded after cookie consent via inline script in Layout.
 * Events fired before consent are silently dropped.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
}

export function trackConversion() {
  track("conversion_complete");
}
export function trackDownloadPng() {
  track("download_png");
}
export function trackDownloadPdf() {
  track("download_pdf");
}
export function trackEmailSignup() {
  track("email_signup");
}
export function trackShareKakao() {
  track("share_kakao");
}
export function trackShareCopyLink() {
  track("share_copy_link");
}
