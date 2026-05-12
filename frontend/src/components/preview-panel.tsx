"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PreviewData, type Comment, type ArchiveEntry, type MediaMetadata, type ImageMetadata } from "@/lib/api";
import { formatBytes, formatDate, categoryColor, confidenceColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X, ExternalLink, FolderOpen, FileText, Link2,
  Clock, MessageCircle, Send, Eye, Info, Archive,
  Music, Video, Code2, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

export function PreviewPanel({
  docId,
  onClose,
}: {
  docId: string;
  onClose: () => void;
}) {
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  const { data: preview, isLoading } = useQuery({
    queryKey: ["preview", docId],
    queryFn: () => api.documents.preview(docId),
    enabled: !!docId,
  });

  const { data: commentsData } = useQuery({
    queryKey: ["comments", docId],
    queryFn: () => api.comments.list(docId),
    enabled: !!docId,
  });

  const addComment = useMutation({
    mutationFn: (content: string) => api.comments.add(docId, content),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", docId] });
      toast.success("Comment added");
    },
  });

  if (isLoading || !preview) {
    return (
      <div style={{ width: 384, borderLeft: "1px solid var(--ink-3)", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: "var(--ink-7)" }}>Loading...</span>
      </div>
    );
  }

  const hasPreviewContent = preview.preview_type !== "none";
  const previewTabIcon = {
    image: <ImageIcon size={12} />,
    pdf: <Eye size={12} />,
    audio: <Music size={12} />,
    video: <Video size={12} />,
    archive: <Archive size={12} />,
    code: <Code2 size={12} />,
    text: <FileText size={12} />,
    document: <FileText size={12} />,
    none: <Eye size={12} />,
  }[preview.preview_type] ?? <Eye size={12} />;

  return (
    <div style={{ width: 384, borderLeft: "1px solid var(--ink-3)", background: "var(--ink-1)", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--ink-3)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-10)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {preview.title}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
            {preview.category && (() => {
              const c = categoryColor(preview.category);
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 7px", borderRadius: 7, fontSize: 10, fontWeight: 500,
                  color: c.fg, background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }} />
                  {preview.category}
                </span>
              );
            })()}
            {preview.subcategory && (
              <span style={{ fontSize: 10, color: "var(--ink-7)", padding: "2px 6px" }}>{preview.subcategory}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <ActionIcon onClick={() => api.documents.open(docId)} title="Open in app">
            <ExternalLink size={13} />
          </ActionIcon>
          <ActionIcon onClick={() => api.documents.reveal(docId)} title="Reveal in Finder">
            <FolderOpen size={13} />
          </ActionIcon>
          <ActionIcon onClick={onClose} title="Close">
            <X size={13} />
          </ActionIcon>
        </div>
      </div>

      <Tabs defaultValue="info" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <TabsList style={{ margin: "8px 12px 0", height: 30 }}>
          <TabsTrigger value="info" style={{ fontSize: 11, gap: 4 }}>
            <Info size={11} />Info
          </TabsTrigger>
          {hasPreviewContent && (
            <TabsTrigger value="preview" style={{ fontSize: 11, gap: 4 }}>
              {previewTabIcon}
              {preview.preview_type === "audio" ? "Player" :
               preview.preview_type === "video" ? "Player" :
               preview.preview_type === "archive" ? "Contents" :
               preview.preview_type === "code" ? "Code" : "Preview"}
            </TabsTrigger>
          )}
          <TabsTrigger value="comments" style={{ fontSize: 11, gap: 4 }}>
            <MessageCircle size={11} />
            {preview.comment_count > 0 ? preview.comment_count : ""}
          </TabsTrigger>
        </TabsList>

        <ScrollArea style={{ flex: 1 }}>
          {/* INFO TAB */}
          <TabsContent value="info" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginTop: 0 }}>
            {preview.summary && (
              <Section label="Summary">
                <p style={{ fontSize: 12, color: "var(--ink-9)", lineHeight: 1.6 }}>{preview.summary}</p>
              </Section>
            )}

            <Section label="Details">
              <MetaGrid rows={[
                ["Size", preview.file_size ? formatBytes(preview.file_size) : "N/A"],
                ["Type", preview.mime_type || "Unknown"],
                ["Language", preview.language || "en"],
                ["Confidence", preview.ai_confidence ? `${Math.round(preview.ai_confidence * 100)}%` : "N/A"],
                ["Indexed", preview.indexed_at ? formatDate(preview.indexed_at) : "N/A"],
                ...(preview.document_date ? [["Doc Date", preview.document_date] as [string, string]] : []),
                ...(preview.page_count ? [["Pages", String(preview.page_count)] as [string, string]] : []),
              ]} />
            </Section>

            {/* Media metadata inline in info tab */}
            {preview.media_metadata && (
              <MediaMetaSection meta={preview.media_metadata} type={preview.preview_type as "audio" | "video"} />
            )}

            {/* Image metadata */}
            {preview.image_metadata && (preview.image_metadata.width || preview.image_metadata.Make) && (
              <Section label="Image Info">
                <MetaGrid rows={[
                  ...(preview.image_metadata.width ? [["Dimensions", `${preview.image_metadata.width} × ${preview.image_metadata.height}`] as [string, string]] : []),
                  ...(preview.image_metadata.Make ? [["Camera", `${preview.image_metadata.Make} ${preview.image_metadata.Model || ""}`.trim()] as [string, string]] : []),
                  ...(preview.image_metadata.DateTimeOriginal ? [["Taken", preview.image_metadata.DateTimeOriginal] as [string, string]] : []),
                  ...(preview.image_metadata.ISOSpeedRatings ? [["ISO", preview.image_metadata.ISOSpeedRatings] as [string, string]] : []),
                  ...(preview.image_metadata.FNumber ? [["f/", preview.image_metadata.FNumber] as [string, string]] : []),
                  ...(preview.image_metadata.ExposureTime ? [["Exposure", preview.image_metadata.ExposureTime] as [string, string]] : []),
                ]} />
              </Section>
            )}

            {preview.tags?.length > 0 && (
              <Section label="Tags">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {preview.tags.map((tag: string) => (
                    <span key={tag} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 7, border: "1px solid var(--ink-4)", color: "var(--ink-8)" }}>{tag}</span>
                  ))}
                </div>
              </Section>
            )}

            {(preview.people?.length > 0 || preview.organizations?.length > 0) && (
              <Section label="Entities">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {preview.people?.map((p: string) => (
                    <Badge key={p} variant="secondary" style={{ fontSize: 10 }}>{p}</Badge>
                  ))}
                  {preview.organizations?.map((o: string) => (
                    <Badge key={o} variant="outline" style={{ fontSize: 10 }}>{o}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {preview.linked_documents?.length > 0 && (
              <Section label={<><Link2 size={10} style={{ display: "inline", marginRight: 4 }} />Linked</>}>
                {preview.linked_documents.map((link) => (
                  <div key={link.id} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, background: "var(--ink-3)", marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, color: "var(--ink-9)" }}>{link.title}</span>
                    <span style={{ color: "var(--ink-6)", marginLeft: 6 }}>{link.link_type}</span>
                  </div>
                ))}
              </Section>
            )}

            {preview.versions?.length > 0 && (
              <Section label={<><Clock size={10} style={{ display: "inline", marginRight: 4 }} />Versions</>}>
                {preview.versions.map((v) => (
                  <div key={v.id} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, background: "var(--ink-3)", marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, color: "var(--ink-9)" }}>v{v.version_number}</span>
                    <span style={{ color: "var(--ink-6)", marginLeft: 6 }}>{v.change_summary}</span>
                  </div>
                ))}
              </Section>
            )}

            <Section label="Path">
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-6)", wordBreak: "break-all", lineHeight: 1.6 }}>
                {preview.file_path}
              </p>
              {!preview.file_exists && (
                <p style={{ fontSize: 11, color: "var(--dv-error)", marginTop: 4 }}>File not found on disk</p>
              )}
            </Section>
          </TabsContent>

          {/* PREVIEW TAB */}
          {hasPreviewContent && (
            <TabsContent value="preview" style={{ padding: 12, marginTop: 0 }}>
              {preview.preview_type === "image" && preview.view_url && (
                <img
                  src={`${API_BASE}/api/documents/${docId}/view`}
                  alt={preview.title || ""}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ink-3)" }}
                />
              )}

              {preview.preview_type === "audio" && (
                <AudioPlayer docId={docId} meta={preview.media_metadata} file_exists={preview.file_exists} />
              )}

              {preview.preview_type === "video" && (
                <VideoPlayer docId={docId} meta={preview.media_metadata} file_exists={preview.file_exists} />
              )}

              {preview.preview_type === "pdf" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {preview.thumbnail_url && (
                    <img
                      src={`${API_BASE}/api/documents/${docId}/thumbnail`}
                      alt="PDF preview"
                      style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ink-3)" }}
                    />
                  )}
                  <button
                    onClick={() => api.documents.open(docId)}
                    style={secondaryBtnStyle}
                  >
                    Open Full PDF
                  </button>
                </div>
              )}

              {(preview.preview_type === "text" || preview.preview_type === "code") && preview.text_preview && (
                <CodeBlock content={preview.text_preview} isCode={preview.preview_type === "code"} ext={preview.file_path?.split(".").pop() || ""} />
              )}

              {preview.preview_type === "archive" && (
                <ArchiveListing entries={preview.archive_contents || []} title={preview.title || ""} />
              )}

              {preview.preview_type === "document" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 0" }}>
                  <FileText size={32} color="var(--ink-6)" strokeWidth={1.2} />
                  <p style={{ fontSize: 13, color: "var(--ink-8)" }}>Office document</p>
                  <button onClick={() => api.documents.open(docId)} style={secondaryBtnStyle}>
                    Open in Default App
                  </button>
                </div>
              )}
            </TabsContent>
          )}

          {/* COMMENTS TAB */}
          <TabsContent value="comments" style={{ padding: 12, marginTop: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {commentsData?.comments.map((comment: Comment) => (
              <CommentItem key={comment.id} comment={comment} docId={docId} />
            ))}
            {(!commentsData?.comments || commentsData.comments.length === 0) && (
              <p style={{ fontSize: 12, color: "var(--ink-6)", textAlign: "center", padding: "20px 0" }}>No comments yet</p>
            )}
            <form
              style={{ display: "flex", gap: 6, marginTop: 4 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (commentText.trim()) addComment.mutate(commentText.trim());
              }}
            >
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                style={{ fontSize: 12 }}
              />
              <Button type="submit" size="icon" disabled={!commentText.trim()}>
                <Send size={13} />
              </Button>
            </form>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function ActionIcon({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center",
        background: "transparent", border: "none", color: "var(--ink-7)", cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--ink-3)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-6)", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function MetaGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
      {rows.map(([label, value]) => (
        <>
          <span key={`l-${label}`} style={{ fontSize: 11, color: "var(--ink-6)" }}>{label}</span>
          <span key={`v-${label}`} style={{ fontSize: 11, color: "var(--ink-9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        </>
      ))}
    </div>
  );
}

function MediaMetaSection({ meta, type }: { meta: MediaMetadata; type: "audio" | "video" }) {
  const rows: [string, string][] = [];
  if (meta.duration_str) rows.push(["Duration", meta.duration_str]);
  if (meta.bitrate_kbps) rows.push(["Bitrate", `${meta.bitrate_kbps} kbps`]);
  if (type === "audio") {
    if (meta.artist) rows.push(["Artist", meta.artist]);
    if (meta.album) rows.push(["Album", meta.album]);
    if (meta.genre) rows.push(["Genre", meta.genre]);
    if (meta.year) rows.push(["Year", meta.year]);
    if (meta.audio_codec) rows.push(["Codec", meta.audio_codec.toUpperCase()]);
    if (meta.channels) rows.push(["Channels", meta.channels === 2 ? "Stereo" : meta.channels === 1 ? "Mono" : String(meta.channels)]);
    if (meta.sample_rate) rows.push(["Sample Rate", `${meta.sample_rate / 1000} kHz`]);
  }
  if (type === "video") {
    if (meta.width && meta.height) rows.push(["Resolution", `${meta.width} × ${meta.height}`]);
    if (meta.fps) rows.push(["Frame Rate", `${meta.fps} fps`]);
    if (meta.video_codec) rows.push(["Video Codec", meta.video_codec.toUpperCase()]);
    if (meta.audio_codec) rows.push(["Audio Codec", meta.audio_codec.toUpperCase()]);
  }
  if (!rows.length) return null;
  return (
    <Section label={type === "audio" ? "Audio Info" : "Video Info"}>
      <MetaGrid rows={rows} />
    </Section>
  );
}

function AudioPlayer({ docId, meta, file_exists }: { docId: string; meta?: MediaMetadata | null; file_exists: boolean }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Track info */}
      {(meta?.title || meta?.artist) && (
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--ink-2)", border: "1px solid var(--ink-3)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-10)" }}>{meta?.title || "Unknown Track"}</div>
          {meta?.artist && <div style={{ fontSize: 11, color: "var(--ink-7)", marginTop: 2 }}>{meta.artist}{meta?.album ? ` — ${meta.album}` : ""}</div>}
          {meta?.duration_str && <div style={{ fontSize: 11, color: "var(--ink-6)", marginTop: 4 }}>{meta.duration_str}{meta?.bitrate_kbps ? ` · ${meta.bitrate_kbps} kbps` : ""}</div>}
        </div>
      )}
      {/* Audio element */}
      {file_exists ? (
        <audio
          controls
          style={{ width: "100%", borderRadius: 8 }}
          src={`${API_BASE}/api/documents/${docId}/view`}
        >
          Your browser does not support audio playback.
        </audio>
      ) : (
        <div style={{ fontSize: 12, color: "var(--dv-error)", textAlign: "center", padding: "16px 0" }}>File not found on disk</div>
      )}
    </div>
  );
}

function VideoPlayer({ docId, meta, file_exists }: { docId: string; meta?: MediaMetadata | null; file_exists: boolean }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {file_exists ? (
        <video
          controls
          style={{ width: "100%", borderRadius: 8, background: "#000", maxHeight: 240 }}
          src={`${API_BASE}/api/documents/${docId}/view`}
        >
          Your browser does not support video playback.
        </video>
      ) : (
        <div style={{ fontSize: 12, color: "var(--dv-error)", textAlign: "center", padding: "16px 0" }}>File not found on disk</div>
      )}
      {meta && (
        <div style={{ fontSize: 11, color: "var(--ink-7)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {meta.duration_str && <span>{meta.duration_str}</span>}
          {meta.width && meta.height && <span>{meta.width} × {meta.height}</span>}
          {meta.fps && <span>{meta.fps} fps</span>}
          {meta.video_codec && <span>{meta.video_codec.toUpperCase()}</span>}
          {meta.bitrate_kbps && <span>{meta.bitrate_kbps} kbps</span>}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ content, isCode, ext }: { content: string; isCode: boolean; ext: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={copy}
        style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 10, padding: "3px 8px", borderRadius: 5,
          background: "var(--ink-4)", border: "1px solid var(--ink-5)",
          color: "var(--ink-8)", cursor: "pointer", zIndex: 1,
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre style={{
        fontSize: 11, fontFamily: "var(--font-mono)", lineHeight: 1.6,
        background: "var(--ink-2)", border: "1px solid var(--ink-3)",
        borderRadius: 8, padding: "12px 14px", overflow: "auto",
        maxHeight: 480, whiteSpace: "pre-wrap", wordBreak: "break-all",
        color: "var(--ink-9)", margin: 0,
      }}>
        {content}
      </pre>
      {isCode && (
        <div style={{ fontSize: 10, color: "var(--ink-5)", marginTop: 4, textAlign: "right" }}>
          .{ext}
        </div>
      )}
    </div>
  );
}

function ArchiveListing({ entries, title }: { entries: ArchiveEntry[]; title: string }) {
  const [filter, setFilter] = useState("");
  const files = entries.filter(e => !e.is_dir);
  const dirs = entries.filter(e => e.is_dir);
  const filtered = filter
    ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--ink-7)" }}>
          {files.length} files, {dirs.length} folders
        </span>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter..."
          style={{
            fontSize: 11, padding: "3px 8px", borderRadius: 5, width: 120,
            background: "var(--ink-3)", border: "1px solid var(--ink-4)",
            color: "var(--ink-9)", outline: "none",
          }}
        />
      </div>
      <div style={{
        border: "1px solid var(--ink-3)", borderRadius: 8, overflow: "hidden",
        maxHeight: 400, overflowY: "auto",
      }}>
        {filtered.map((entry, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 10px", fontSize: 11,
              borderTop: i > 0 ? "1px solid var(--ink-3)" : "none",
              background: entry.is_dir ? "var(--ink-2)" : "transparent",
            }}
          >
            <span style={{
              fontFamily: "var(--font-mono)", color: entry.is_dir ? "var(--ink-8)" : "var(--ink-9)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
            }}>
              {entry.is_dir ? "📁 " : ""}{entry.name}
            </span>
            {!entry.is_dir && entry.size > 0 && (
              <span style={{ color: "var(--ink-6)", marginLeft: 8, flexShrink: 0 }}>
                {formatBytes(entry.size)}
              </span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--ink-6)", fontSize: 11 }}>No matches</div>
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment, docId }: { comment: Comment; docId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ background: "var(--ink-2)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--ink-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-9)" }}>{comment.user_name}</span>
          <span style={{ fontSize: 10, color: "var(--ink-6)" }}>{formatDate(comment.created_at)}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-8)", lineHeight: 1.5 }}>{comment.content}</p>
      </div>
      {comment.replies?.map((reply: Comment) => (
        <div key={reply.id} style={{ marginLeft: 16, background: "var(--ink-2)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--ink-3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-9)" }}>{reply.user_name}</span>
            <span style={{ fontSize: 10, color: "var(--ink-6)" }}>{formatDate(reply.created_at)}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-8)", lineHeight: 1.5 }}>{reply.content}</p>
        </div>
      ))}
    </div>
  );
}

const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 7,
  background: "var(--ink-3)", border: "1px solid var(--ink-5)",
  color: "var(--ink-9)", cursor: "pointer", width: "100%",
};
