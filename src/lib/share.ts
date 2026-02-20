const SITE_URL = "https://ourcoloring.com";

interface ShareText {
  title: string;
  text: string;
}

const SHARE_TEXT: Record<string, ShareText> = {
  ko: {
    title: "OurColoring - 사진으로 색칠공부 만들기",
    text: "사진 한 장으로 우리 아이 색칠공부를 만들어보세요!",
  },
  en: {
    title: "OurColoring - Turn Photos into Coloring Pages",
    text: "Turn any photo into a printable coloring page!",
  },
};

function getUrl(locale: string): string {
  return `${SITE_URL}/${locale}/`;
}

function getText(locale: string): ShareText {
  return SHARE_TEXT[locale] ?? SHARE_TEXT.ko;
}

/**
 * KakaoTalk share — uses Web Share API on mobile (KakaoTalk appears
 * in the native share sheet), falls back to clipboard copy on desktop.
 */
export async function shareKakao(locale: string): Promise<boolean> {
  // Try Kakao SDK first (if initialized)
  if (
    typeof window !== "undefined" &&
    (window as any).Kakao?.isInitialized()
  ) {
    try {
      const Kakao = (window as any).Kakao;
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: getText(locale).title,
          description: getText(locale).text,
          imageUrl: `${SITE_URL}/og-image.jpg`,
          link: {
            mobileWebUrl: getUrl(locale),
            webUrl: getUrl(locale),
          },
        },
      });
      return true;
    } catch {
      // fall through
    }
  }

  // Fallback: native Web Share API (shows KakaoTalk on mobile)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: getText(locale).title,
        text: getText(locale).text,
        url: getUrl(locale),
      });
      return true;
    } catch {
      // user cancelled or API not supported
      return false;
    }
  }

  // Last resort: copy link
  return copyLink(locale);
}

export async function copyLink(locale: string): Promise<boolean> {
  const url = getUrl(locale);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}
