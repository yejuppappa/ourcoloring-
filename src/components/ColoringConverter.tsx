import { useState, useRef, useCallback, useEffect } from "react";
import {
  convertImage,
  createPreviewUrl,
  type BackgroundMode,
  type Difficulty,
} from "@/lib/convert-api";
import {
  canConvert,
  incrementCount,
  getRemainingCount,
  setEmail as saveEmail,
  validateEmail,
} from "@/lib/daily-limit";
import { downloadPNG, savePNGMobile, isMobile, downloadPDF } from "@/lib/download";
import { shareKakao, copyLink } from "@/lib/share";
import {
  trackConversion,
  trackDownloadPng,
  trackDownloadPdf,
  trackEmailSignup,
  trackShareKakao,
  trackShareCopyLink,
} from "@/lib/analytics";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

// Sample image maps
const BG_SAMPLES: Record<BackgroundMode, string> = {
  keep: "/samples/dog-keep-bg.webp",
  remove: "/samples/dog-remove-bg.webp",
  create: "/samples/dog-create-bg.webp",
};

const DIFF_SAMPLES: Record<Difficulty, string> = {
  high: "/samples/robot-detail.webp",
  medium: "/samples/robot-medium.webp",
  low: "/samples/robot-simple.webp",
};

interface Translations {
  uploadTitle: string;
  uploadSubtitle: string;
  uploadFormats: string;
  errorFormat: string;
  errorSize: string;
  errorGeneric: string;
  errorRetry: string;
  modeTitle: string;
  modeKeep: string;
  modeKeepDesc: string;
  modeRemove: string;
  modeRemoveDesc: string;
  modeCreate: string;
  modeCreateDesc: string;
  difficultyTitle: string;
  difficultyHigh: string;
  difficultyHighDesc: string;
  difficultyMedium: string;
  difficultyMediumDesc: string;
  difficultyLow: string;
  difficultyLowDesc: string;
  convertButton: string;
  processing: string;
  loadingMsg1: string;
  loadingMsg2: string;
  loadingMsg3: string;
  viewOriginal: string;
  viewResult: string;
  tryAnother: string;
  privacy: string;
  downloadPng: string;
  downloadPngMobile: string;
  downloadPdf: string;
  downloadPreparing: string;
  limitCounter: string;
  limitTooltip: string;
  limitTitle: string;
  limitSubtitle: string;
  limitEmailPlaceholder: string;
  limitSubmit: string;
  limitInvalidEmail: string;
  shareKakao: string;
  shareCopyLink: string;
  shareCopied: string;
  sampleSectionTitle: string;
  sampleDiffTitle: string;
  sampleBgTitle: string;
  sampleDiffNote: string;
  uploadFirst: string;
  sampleOriginal: string;
}

interface Props {
  t: Translations;
  locale: string;
}

type Phase = "idle" | "email-gate" | "loading" | "result";

export default function ColoringConverter({ t, locale }: Props) {
  // ── State ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploadFirstMsg, setUploadFirstMsg] = useState(false);
  const [mobile, setMobile] = useState(false);

  // File & preview
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  // Options
  const [mode, setMode] = useState<BackgroundMode>("keep");
  const [difficulty, setDifficulty] = useState<Difficulty>("high");

  // View toggle
  const [viewMode, setViewMode] = useState<"original" | "result">("result");

  // Limit
  const [limit, setLimit] = useState({ remaining: 3, total: 3 });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Loading animation
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Download
  const [pdfLoading, setPdfLoading] = useState(false);

  // Share
  const [copied, setCopied] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convertBtnRef = useRef<HTMLButtonElement>(null);

  const loadingMessages = [t.loadingMsg1, t.loadingMsg2, t.loadingMsg3];

  // Initialize on mount
  useEffect(() => {
    setLimit(getRemainingCount());
    setMobile(isMobile());
    document.getElementById("converter-skeleton")?.remove();
  }, []);

  // Cycle loading messages
  useEffect(() => {
    if (phase !== "loading") return;
    setLoadingMsgIdx(0);
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  // Auto-hide "upload first" message
  useEffect(() => {
    if (!uploadFirstMsg) return;
    const timer = setTimeout(() => setUploadFirstMsg(false), 2500);
    return () => clearTimeout(timer);
  }, [uploadFirstMsg]);

  // ── File validation ────────────────────────────────────
  const validateFile = useCallback(
    (f: File): string | null => {
      if (!ACCEPTED_TYPES.includes(f.type)) return t.errorFormat;
      if (f.size > MAX_SIZE) return t.errorSize;
      return null;
    },
    [t],
  );

  // ── Handle file selection ──────────────────────────────
  const handleFile = useCallback(
    (f: File) => {
      const validationError = validateFile(f);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");
      setUploadFirstMsg(false);
      setFile(f);
      setOriginalUrl(createPreviewUrl(f));

      // Scroll to convert button after a brief delay
      setTimeout(() => {
        convertBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    },
    [validateFile],
  );

  // ── Convert ────────────────────────────────────────────
  const handleConvert = useCallback(async () => {
    if (!file) {
      setUploadFirstMsg(true);
      return;
    }

    if (!canConvert()) {
      setPhase("email-gate");
      return;
    }

    setPhase("loading");
    setError("");

    try {
      const url = await convertImage(file, mode, difficulty);
      setResultUrl(url);
      setViewMode("result");
      setPhase("result");

      incrementCount();
      setLimit(getRemainingCount());
      trackConversion();
    } catch {
      setError(t.errorGeneric);
      setPhase("idle");
    }
  }, [file, mode, difficulty, t.errorGeneric]);

  // ── Email submit ───────────────────────────────────────
  const handleEmailSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateEmail(email)) {
        setEmailError(t.limitInvalidEmail);
        return;
      }

      saveEmail(email);
      setLimit(getRemainingCount());
      setEmailError("");
      trackEmailSignup();
      setPhase("idle");
    },
    [email, t.limitInvalidEmail],
  );

  // ── Download handlers ──────────────────────────────────
  const handleDownloadPng = useCallback(async () => {
    if (!resultUrl) return;
    if (mobile) {
      await savePNGMobile(resultUrl);
    } else {
      downloadPNG(resultUrl);
    }
    trackDownloadPng();
  }, [resultUrl, mobile]);

  const handleDownloadPdf = useCallback(async () => {
    if (!resultUrl) return;
    setPdfLoading(true);
    try {
      await downloadPDF(resultUrl);
      trackDownloadPdf();
    } finally {
      setPdfLoading(false);
    }
  }, [resultUrl]);

  // ── Share handlers ─────────────────────────────────────
  const handleShareKakao = useCallback(() => {
    shareKakao(locale);
    trackShareKakao();
  }, [locale]);

  const handleCopyLink = useCallback(async () => {
    const ok = await copyLink(locale);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackShareCopyLink();
    }
  }, [locale]);

  // ── Reset ──────────────────────────────────────────────
  const reset = useCallback(() => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setPhase("idle");
    setFile(null);
    setOriginalUrl("");
    setResultUrl("");
    setError("");
    setUploadFirstMsg(false);
    setMode("keep");
    setDifficulty("high");
    setViewMode("result");
    setPdfLoading(false);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [originalUrl]);

  // ── Drag & Drop ────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // PNG button label (device-dependent)
  const pngLabel = mobile ? t.downloadPngMobile : t.downloadPng;

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-xl px-4">
      {/* Limit counter */}
      {(phase === "idle" || phase === "result") && (
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-sm text-[#7A7067] shadow-sm ring-1 ring-[#E8DFD6]">
            {t.limitCounter}:{" "}
            <span className="font-bold text-[#FF6B4A]">
              {limit.remaining}/{limit.total}
            </span>
            <span className="relative group">
              <button
                type="button"
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#E8DFD6] text-[11px] font-bold text-[#7A7067] transition-colors hover:bg-[#FF6B4A] hover:text-white"
                onClick={(e) => {
                  const tip = (e.currentTarget.nextElementSibling as HTMLElement);
                  tip.classList.toggle("hidden");
                }}
              >
                ?
              </button>
              <span className="hidden group-hover:md:block absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-xl bg-[#3D3530] px-4 py-3 text-xs leading-relaxed text-white shadow-lg">
                {t.limitTooltip}
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-[#3D3530]"></span>
              </span>
            </span>
          </span>
        </div>
      )}

      {/* ── Idle: Upload + Options + Samples ─────────── */}
      {phase === "idle" && (
        <div className="space-y-6">
          {/* Upload area */}
          {!file ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  fileInputRef.current?.click();
              }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition-all duration-200 ${
                isDragging
                  ? "scale-[1.01] border-[#FF6B4A] bg-[#FFF0E5] shadow-md"
                  : "border-[#D4C8BE] bg-white shadow-sm hover:border-[#FF6B4A] hover:bg-[#FFFAF5] hover:shadow-md"
              }`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF0E5] to-[#FFE0D0]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#FF6B4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-lg font-bold text-[#3D3530]">{t.uploadTitle}</p>
              <p className="mt-1 text-sm text-[#7A7067]">{t.uploadSubtitle}</p>
              <p className="mt-3 text-xs text-[#A09890]">{t.uploadFormats}</p>
            </div>
          ) : (
            /* Preview thumbnail + convert button right below */
            <div>
              <div className="overflow-hidden rounded-2xl border border-[#E8DFD6] bg-white shadow-md">
                <img
                  src={originalUrl}
                  alt="Preview"
                  className="mx-auto max-h-52 object-contain p-2"
                />
                <div className="border-t border-[#E8DFD6] px-4 py-2.5 text-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-medium text-[#7A7067] hover:text-[#FF6B4A] hover:underline"
                  >
                    {t.tryAnother}
                  </button>
                </div>
              </div>
              {/* Convert button — directly after photo */}
              <button
                ref={convertBtnRef}
                onClick={handleConvert}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#FF6B4A] to-[#FF8F6B] px-4 py-4 text-base font-bold text-white shadow-lg shadow-[#FF6B4A]/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-[#FF6B4A]/30 active:scale-[0.98]"
              >
                {t.convertButton}
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          {/* "Upload first" toast */}
          {uploadFirstMsg && (
            <div className="rounded-xl bg-[#FFF0E5] px-4 py-3 text-center text-sm font-medium text-[#FF6B4A] ring-1 ring-[#FFD4C4]">
              {t.uploadFirst}
            </div>
          )}

          {/* Background mode */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8DFD6]">
            <h3 className="mb-3 text-sm font-bold text-[#3D3530]">{t.modeTitle}</h3>
            <div className="grid grid-cols-3 gap-2">
              <ModeCard
                selected={mode === "keep"}
                onClick={() => setMode("keep")}
                emoji="🏞️"
                title={t.modeKeep}
                desc={t.modeKeepDesc}
              />
              <ModeCard
                selected={mode === "remove"}
                onClick={() => setMode("remove")}
                emoji="✂️"
                title={t.modeRemove}
                desc={t.modeRemoveDesc}
              />
              <ModeCard
                selected={mode === "create"}
                onClick={() => setMode("create")}
                emoji="🎨"
                title={t.modeCreate}
                desc={t.modeCreateDesc}
              />
            </div>
            <SampleCompare
              originalSrc="/samples/dog-original.webp"
              resultSrc={BG_SAMPLES[mode]}
              originalLabel={t.sampleOriginal}
              resultLabel={t.viewResult}
            />
          </div>

          {/* Difficulty */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8DFD6]">
            <h3 className="mb-3 text-sm font-bold text-[#3D3530]">{t.difficultyTitle}</h3>
            <div className="grid grid-cols-3 gap-2">
              <DifficultyBtn
                selected={difficulty === "high"}
                onClick={() => setDifficulty("high")}
                title={t.difficultyHigh}
                desc={t.difficultyHighDesc}
              />
              <DifficultyBtn
                selected={difficulty === "medium"}
                onClick={() => setDifficulty("medium")}
                title={t.difficultyMedium}
                desc={t.difficultyMediumDesc}
              />
              <DifficultyBtn
                selected={difficulty === "low"}
                onClick={() => setDifficulty("low")}
                title={t.difficultyLow}
                desc={t.difficultyLowDesc}
              />
            </div>
            <SampleCompare
              originalSrc="/samples/robot-original.webp"
              resultSrc={DIFF_SAMPLES[difficulty]}
              originalLabel={t.sampleOriginal}
              resultLabel={t.viewResult}
            />
            <p className="mt-2 text-center text-xs text-[#A09890]">
              {t.sampleDiffNote}
            </p>
          </div>

          <PrivacyBadge text={t.privacy} />
        </div>
      )}

      {/* ── Email Gate ───────────────────────────────── */}
      {phase === "email-gate" && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-md ring-1 ring-[#E8DFD6]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF0E5] to-[#FFE0D0]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#FF6B4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-[#3D3530]">{t.limitTitle}</h2>
          <p className="mt-2 text-sm text-[#7A7067]">{t.limitSubtitle}</p>

          <form onSubmit={handleEmailSubmit} className="mt-5">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder={t.limitEmailPlaceholder}
              className="w-full rounded-xl border border-[#D4C8BE] px-4 py-3 text-center text-[#3D3530] placeholder-[#A09890] outline-none transition-shadow focus:border-[#FF6B4A] focus:ring-2 focus:ring-[#FF6B4A]/20"
            />
            {emailError && <p className="mt-2 text-sm text-red-500">{emailError}</p>}
            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF8F6B] px-4 py-3 font-semibold text-white shadow-md shadow-[#FF6B4A]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.limitSubmit}
            </button>
          </form>

          <button
            onClick={reset}
            className="mt-3 text-sm text-[#A09890] underline hover:text-[#3D3530]"
          >
            {t.tryAnother}
          </button>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────── */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-20 shadow-md ring-1 ring-[#E8DFD6]">
          <div className="relative mb-6">
            <div className="flex items-center justify-center">
              <span className="animate-bounce text-5xl" style={{ animationDuration: "1.2s" }}>
                🖍️
              </span>
            </div>
            <div className="mt-3 flex justify-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B4A] animate-pulse" style={{ animationDelay: "0s" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-[#FFB347] animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B4A] animate-pulse" style={{ animationDelay: "0.4s" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-[#FFB347] animate-pulse" style={{ animationDelay: "0.6s" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B4A] animate-pulse" style={{ animationDelay: "0.8s" }} />
            </div>
          </div>
          <p className="text-[#7A7067] transition-opacity duration-300">
            {loadingMessages[loadingMsgIdx]}
          </p>
        </div>
      )}

      {/* ── Result ───────────────────────────────────── */}
      {phase === "result" && (
        <div>
          {/* View toggle */}
          <div className="mb-3 flex justify-center gap-1 rounded-xl bg-[#F5EDE4] p-1">
            <ToggleBtn active={viewMode === "result"} onClick={() => setViewMode("result")} label={t.viewResult} />
            <ToggleBtn active={viewMode === "original"} onClick={() => setViewMode("original")} label={t.viewOriginal} />
          </div>

          {/* Image */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#E8DFD6]">
            <img
              src={viewMode === "result" ? resultUrl : originalUrl}
              alt={viewMode === "result" ? t.viewResult : t.viewOriginal}
              className="w-full"
            />
          </div>

          {/* Download */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadPng}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF8F6B] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#FF6B4A]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {mobile ? <PhotoIcon /> : <DownloadIcon />}
              {pngLabel}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#FF6B4A] bg-white px-4 py-3.5 text-sm font-semibold text-[#FF6B4A] shadow-sm transition-all hover:scale-[1.02] hover:bg-[#FFF5F0] active:scale-[0.98] disabled:opacity-60"
            >
              <DownloadIcon />
              {pdfLoading ? t.downloadPreparing : t.downloadPdf}
            </button>
          </div>

          {/* Share */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={handleShareKakao}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3.5 text-sm font-semibold text-[#3D1D1C] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <KakaoIcon />
              {t.shareKakao}
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-medium text-[#7A7067] shadow-sm ring-1 ring-[#D4C8BE] transition-all hover:ring-[#3D3530] hover:text-[#3D3530]"
            >
              <LinkIcon />
              {copied ? t.shareCopied : t.shareCopyLink}
            </button>
          </div>

          {/* Try another */}
          <button
            onClick={reset}
            className="mt-4 w-full rounded-xl bg-white px-4 py-3.5 text-sm font-medium text-[#7A7067] shadow-sm ring-1 ring-[#D4C8BE] transition-all hover:ring-[#FF6B4A] hover:text-[#FF6B4A]"
          >
            {t.tryAnother}
          </button>

          <PrivacyBadge text={t.privacy} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────

function SampleCompare({
  originalSrc,
  resultSrc,
  originalLabel,
  resultLabel,
}: {
  originalSrc: string;
  resultSrc: string;
  originalLabel: string;
  resultLabel: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex-1 overflow-hidden rounded-xl bg-[#FAFAF8] ring-1 ring-[#E8DFD6]">
        <img src={originalSrc} alt={originalLabel} loading="lazy" className="w-full object-cover" />
        <p className="bg-[#F5EDE4] py-1 text-center text-[10px] font-semibold text-[#7A7067]">{originalLabel}</p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-[#D4C8BE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      <div className="flex-1 overflow-hidden rounded-xl bg-[#FAFAF8] ring-1 ring-[#E8DFD6]">
        <img src={resultSrc} alt={resultLabel} loading="lazy" className="w-full object-cover" />
        <p className="bg-[#F5EDE4] py-1 text-center text-[10px] font-semibold text-[#7A7067]">{resultLabel}</p>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  onClick,
  emoji,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl border-2 px-2 py-3 text-center transition-all duration-150 ${
        selected
          ? "border-[#FF6B4A] bg-[#FFF0E5] shadow-md shadow-[#FF6B4A]/10"
          : "border-[#E8DFD6] bg-white hover:border-[#FFB8A3] hover:shadow-sm"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="mt-1.5 text-xs font-bold text-[#3D3530]">{title}</span>
      <span className="mt-0.5 text-[10px] leading-tight text-[#7A7067]">{desc}</span>
    </button>
  );
}

function DifficultyBtn({
  selected,
  onClick,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-2.5 text-center transition-all duration-150 ${
        selected
          ? "border-[#FF6B4A] bg-[#FFF0E5] shadow-md shadow-[#FF6B4A]/10"
          : "border-[#E8DFD6] bg-white hover:border-[#FFB8A3] hover:shadow-sm"
      }`}
    >
      <span className="block text-sm font-bold text-[#3D3530]">{title}</span>
      <span className="block text-[10px] text-[#7A7067]">{desc}</span>
    </button>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active ? "bg-white text-[#3D3530] shadow-sm" : "text-[#7A7067] hover:text-[#3D3530]"
      }`}
    >
      {label}
    </button>
  );
}

function PrivacyBadge({ text }: { text: string }) {
  return (
    <p className="mt-5 flex items-center justify-center gap-2 text-sm text-[#A09890]">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
      {text}
    </p>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.725 1.78 5.117 4.471 6.473-.163.586-.592 2.127-.678 2.457-.106.41.15.405.316.294.13-.087 2.07-1.398 2.907-1.966A12.58 12.58 0 0012 18.382c5.523 0 10-3.463 10-7.691S17.523 3 12 3z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}
