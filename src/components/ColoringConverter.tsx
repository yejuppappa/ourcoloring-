import { useState, useRef, useCallback, useEffect } from "react";
import {
  loadAndPrepare,
  processWithSettings,
  type ProcessingCache,
} from "@/lib/edge-detection";
import {
  canConvert,
  incrementCount,
  getRemainingCount,
  setEmail as saveEmail,
  validateEmail,
} from "@/lib/daily-limit";
import { downloadPNG, downloadPDF } from "@/lib/download";
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

interface Translations {
  uploadTitle: string;
  uploadSubtitle: string;
  uploadFormats: string;
  errorFormat: string;
  errorSize: string;
  errorGeneric: string;
  processing: string;
  sensitivity: string;
  thickness: string;
  viewOriginal: string;
  viewResult: string;
  tryAnother: string;
  privacy: string;
  downloadPng: string;
  downloadPdf: string;
  downloadPreparing: string;
  limitCounter: string;
  limitUnlimited: string;
  limitTitle: string;
  limitSubtitle: string;
  limitEmailPlaceholder: string;
  limitSubmit: string;
  limitInvalidEmail: string;
  shareKakao: string;
  shareCopyLink: string;
  shareCopied: string;
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
  const [originalUrl, setOriginalUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [sensitivity, setSensitivity] = useState(50);
  const [thickness, setThickness] = useState(2);
  const [viewMode, setViewMode] = useState<"original" | "result">("result");

  // limit
  const [limit, setLimit] = useState({ remaining: 3, total: 3, unlimited: false });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // download
  const [pdfLoading, setPdfLoading] = useState(false);

  // share
  const [copied, setCopied] = useState(false);

  // refs
  const cacheRef = useRef<ProcessingCache | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const debounceRef = useRef<number>(0);

  // Initialize limit on mount
  useEffect(() => {
    setLimit(getRemainingCount());
  }, []);

  // ── File validation ────────────────────────────────────
  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) return t.errorFormat;
      if (file.size > MAX_SIZE) return t.errorSize;
      return null;
    },
    [t],
  );

  // ── Process file (after limit check) ──────────────────
  const processFile = useCallback(
    async (file: File) => {
      setPhase("loading");
      setViewMode("result");
      setError("");

      try {
        const cache = await loadAndPrepare(file);
        cacheRef.current = cache;
        setOriginalUrl(cache.originalUrl);

        const url = processWithSettings(cache, { sensitivity, thickness });
        setResultUrl(url);
        setPhase("result");

        incrementCount();
        setLimit(getRemainingCount());
        trackConversion();
      } catch {
        setError(t.errorGeneric);
        setPhase("idle");
      }
    },
    [sensitivity, thickness, t.errorGeneric],
  );

  // ── Handle file selection ──────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");

      if (!canConvert()) {
        pendingFileRef.current = file;
        setPhase("email-gate");
        return;
      }

      await processFile(file);
    },
    [validateFile, processFile],
  );

  // ── Email submit ───────────────────────────────────────
  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateEmail(email)) {
        setEmailError(t.limitInvalidEmail);
        return;
      }

      saveEmail(email);
      setLimit(getRemainingCount());
      setEmailError("");
      trackEmailSignup();

      if (pendingFileRef.current) {
        await processFile(pendingFileRef.current);
        pendingFileRef.current = null;
      }
    },
    [email, t.limitInvalidEmail, processFile],
  );

  // ── Reprocess on control change ────────────────────────
  useEffect(() => {
    if (!cacheRef.current || phase !== "result") return;

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const url = processWithSettings(cacheRef.current!, {
        sensitivity,
        thickness,
      });
      setResultUrl(url);
    }, 150);

    return () => window.clearTimeout(debounceRef.current);
  }, [sensitivity, thickness, phase]);

  // ── Download handlers ──────────────────────────────────
  const handleDownloadPng = useCallback(() => {
    if (cacheRef.current) {
      downloadPNG(cacheRef.current, { sensitivity, thickness });
      trackDownloadPng();
    }
  }, [sensitivity, thickness]);

  const handleDownloadPdf = useCallback(async () => {
    if (!cacheRef.current) return;
    setPdfLoading(true);
    try {
      await downloadPDF(cacheRef.current, { sensitivity, thickness });
      trackDownloadPdf();
    } finally {
      setPdfLoading(false);
    }
  }, [sensitivity, thickness]);

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
    cacheRef.current = null;
    pendingFileRef.current = null;
    setPhase("idle");
    setOriginalUrl("");
    setResultUrl("");
    setError("");
    setSensitivity(50);
    setThickness(2);
    setViewMode("result");
    setPdfLoading(false);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-xl px-4">
      {/* Limit counter (shown in idle & result) */}
      {(phase === "idle" || phase === "result") && (
        <div className="mb-3 text-center text-sm text-[#A09890]">
          {t.limitCounter}:{" "}
          <span className="font-semibold text-[#3D3530]">
            {limit.unlimited
              ? t.limitUnlimited
              : `${limit.remaining}/${limit.total}`}
          </span>
        </div>
      )}

      {/* ── Idle: Upload ─────────────────────────────── */}
      {phase === "idle" && (
        <div>
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
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 transition-all duration-200 ${
              isDragging
                ? "scale-[1.01] border-[#FF6B4A] bg-[#FFF0E5]"
                : "border-[#D4C8BE] bg-white hover:border-[#FF6B4A] hover:bg-[#FFFAF5]"
            }`}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0E5]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#FF6B4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-[#3D3530]">{t.uploadTitle}</p>
            <p className="mt-1 text-sm text-[#7A7067]">{t.uploadSubtitle}</p>
            <p className="mt-3 text-xs text-[#A09890]">{t.uploadFormats}</p>
          </div>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />

          {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}

          <PrivacyBadge text={t.privacy} />
        </div>
      )}

      {/* ── Email Gate ───────────────────────────────── */}
      {phase === "email-gate" && (
        <div className="rounded-2xl border border-[#E8DFD6] bg-white p-6 text-center shadow-sm">
          {/* Illustration */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0E5]">
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
              className="w-full rounded-xl border border-[#D4C8BE] px-4 py-3 text-center text-[#3D3530] placeholder-[#A09890] outline-none focus:border-[#FF6B4A] focus:ring-2 focus:ring-[#FF6B4A]/20"
            />
            {emailError && <p className="mt-2 text-sm text-red-500">{emailError}</p>}
            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-[#FF6B4A] px-4 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#FFD6C9] border-t-[#FF6B4A]" />
          <p className="mt-4 text-[#7A7067]">{t.processing}</p>
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
          <div className="overflow-hidden rounded-2xl border border-[#E8DFD6] bg-white shadow-sm">
            <img
              src={viewMode === "result" ? resultUrl : originalUrl}
              alt={viewMode === "result" ? t.viewResult : t.viewOriginal}
              className="w-full"
            />
          </div>

          {/* Controls */}
          <div className="mt-5 space-y-4 rounded-2xl border border-[#E8DFD6] bg-white p-5 shadow-sm">
            <Slider id="sensitivity" label={t.sensitivity} value={sensitivity} min={5} max={95} onChange={setSensitivity} />
            <Slider id="thickness" label={t.thickness} value={thickness} min={1} max={5} onChange={setThickness} />
          </div>

          {/* Download */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadPng}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FF6B4A] px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <DownloadIcon />
              {t.downloadPng}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#FF6B4A] px-4 py-3 text-sm font-semibold text-[#FF6B4A] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              <DownloadIcon />
              {pdfLoading ? t.downloadPreparing : t.downloadPdf}
            </button>
          </div>

          {/* Share */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={handleShareKakao}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#3D1D1C] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <KakaoIcon />
              {t.shareKakao}
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#D4C8BE] bg-white px-4 py-3 text-sm font-medium text-[#7A7067] transition-colors hover:border-[#3D3530] hover:text-[#3D3530]"
            >
              <LinkIcon />
              {copied ? t.shareCopied : t.shareCopyLink}
            </button>
          </div>

          {/* Try another */}
          <button
            onClick={reset}
            className="mt-4 w-full rounded-xl border border-[#D4C8BE] bg-white px-4 py-3 text-sm font-medium text-[#7A7067] transition-colors hover:border-[#FF6B4A] hover:text-[#FF6B4A]"
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

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-white text-[#3D3530] shadow-sm" : "text-[#7A7067] hover:text-[#3D3530]"
      }`}
    >
      {label}
    </button>
  );
}

function Slider({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-[#3D3530]">{label}</label>
        <span className="text-xs text-[#A09890]">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[#FF6B4A]"
      />
    </div>
  );
}

function PrivacyBadge({ text }: { text: string }) {
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#A09890]">
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
