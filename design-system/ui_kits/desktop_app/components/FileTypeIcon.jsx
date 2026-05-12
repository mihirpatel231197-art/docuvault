function inferFileType(mime) {
  if (!mime) return "default";
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("word") || mime.includes("msword")) return "word";
  if (mime.includes("sheet") || mime.includes("excel")) return "excel";
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("javascript")) return "code";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "default";
}

const FT_META = {
  pdf:    { label: "PDF",  color: "var(--ft-pdf)",    bg: "oklch(0.66 0.20 25 / 0.15)",  icon: "file-text" },
  image:  { label: "IMG",  color: "var(--ft-image)",  bg: "oklch(0.74 0.16 0 / 0.15)",   icon: "file-image" },
  word:   { label: "DOC",  color: "var(--ft-word)",   bg: "oklch(0.65 0.16 248 / 0.15)", icon: "file-text" },
  excel:  { label: "XLS",  color: "var(--ft-excel)",  bg: "oklch(0.72 0.16 145 / 0.15)", icon: "file-spreadsheet" },
  code:   { label: "{ }",  color: "var(--ft-code)",   bg: "oklch(0.65 0.01 264 / 0.20)", icon: "file-code-2" },
  audio:  { label: "WAV",  color: "var(--ft-audio)",  bg: "oklch(0.68 0.18 295 / 0.15)", icon: "file-audio" },
  video:  { label: "MP4",  color: "var(--ft-video)",  bg: "oklch(0.74 0.16 50 / 0.15)",  icon: "file-video" },
  default:{ label: "···",  color: "var(--ft-default)",bg: "oklch(0.60 0.01 264 / 0.20)", icon: "file" },
};

function FileTypeIcon({ mime, size = 32, mode = "label" /* label | icon */ }) {
  const t = inferFileType(mime);
  const meta = FT_META[t];
  return (
    <div style={{ width: size, height: size, borderRadius: "var(--radius-md)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                  background: meta.bg, color: meta.color,
                  fontFamily: "var(--font-mono)", fontSize: size <= 28 ? 9 : 10, fontWeight: 700, letterSpacing: 0.02 }}>
      {mode === "label" ? meta.label : <Icon name={meta.icon} size={Math.round(size * 0.5)} strokeWidth={1.6} />}
    </div>
  );
}

Object.assign(window, { inferFileType, FileTypeIcon, FT_META });
