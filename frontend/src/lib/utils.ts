import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hours ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Category colors — 12-hue hash palette from design system ──────────────

const CAT_HUES = [248, 165, 145, 90, 70, 45, 25, 8, 340, 305, 280, 215];

function categoryHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 12;
}

export function categoryColor(name: string): {
  fg: string; bg: string; border: string; dot: string;
} {
  const hue = CAT_HUES[categoryHash(name)];
  return {
    fg: `oklch(0.74 0.16 ${hue})`,
    bg: `oklch(0.74 0.16 ${hue} / 0.12)`,
    border: `oklch(0.74 0.16 ${hue} / 0.30)`,
    dot: `oklch(0.74 0.16 ${hue})`,
  };
}

// ── File type metadata from design system ─────────────────────────────────

export type FileType = "pdf" | "image" | "word" | "excel" | "code" | "audio" | "video" | "default";

export function inferFileType(mime: string | null): FileType {
  if (!mime) return "default";
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("word") || mime.includes("msword") || mime.includes("document")) return "word";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("spreadsheet")) return "excel";
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("javascript") || mime.includes("xml") || mime.includes("yaml")) return "code";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "default";
}

export const FILE_TYPE_META: Record<FileType, { label: string; color: string; bg: string; icon: string }> = {
  pdf:     { label: "PDF",  color: "var(--ft-pdf)",    bg: "oklch(0.66 0.20 25 / 0.15)",  icon: "file-text" },
  image:   { label: "IMG",  color: "var(--ft-image)",  bg: "oklch(0.74 0.16 0 / 0.15)",   icon: "file-image" },
  word:    { label: "DOC",  color: "var(--ft-word)",   bg: "oklch(0.65 0.16 248 / 0.15)", icon: "file-text" },
  excel:   { label: "XLS",  color: "var(--ft-excel)",  bg: "oklch(0.72 0.16 145 / 0.15)", icon: "file-spreadsheet" },
  code:    { label: "{ }",  color: "var(--ft-code)",   bg: "oklch(0.65 0.01 264 / 0.20)", icon: "file-code-2" },
  audio:   { label: "WAV",  color: "var(--ft-audio)",  bg: "oklch(0.68 0.18 295 / 0.15)", icon: "file-audio" },
  video:   { label: "MP4",  color: "var(--ft-video)",  bg: "oklch(0.74 0.16 50 / 0.15)",  icon: "file-video" },
  default: { label: "...",  color: "var(--ft-default)", bg: "oklch(0.60 0.01 264 / 0.20)", icon: "file" },
};

// ── Confidence color from design system ───────────────────────────────────

export function confidenceColor(value: number): { fg: string; bg: string } {
  if (value > 0.8) return { fg: "var(--dv-success)", bg: "var(--dv-success-bg)" };
  if (value > 0.5) return { fg: "var(--dv-warning)", bg: "var(--dv-warning-bg)" };
  return { fg: "var(--dv-danger)", bg: "var(--dv-danger-bg)" };
}
