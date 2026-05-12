"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Send, Loader2, Trash2, CalendarClock, Search as SearchIcon,
  FileText, Users, ArrowUpRight, Paperclip, AlertTriangle,
  AlertCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { categoryColor } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ id: string; title: string; category: string }>;
}

async function sendChat(message: string) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: insights } = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetch(`${API_BASE}/api/insights`).then(r => r.json()),
    staleTime: 120_000,
  });

  const mutation = useMutation({
    mutationFn: sendChat,
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response, sources: data.sources }]);
    },
    onError: () => toast.error("Failed to get response"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    mutation.mutate(text);
  };

  const starters = [
    { icon: CalendarClock, q: "What's expiring in the next 60 days?" },
    { icon: SearchIcon, q: "Find my 2023 tax documents" },
    { icon: FileText, q: "Summarize my lease agreement" },
    { icon: Users, q: "Who is mentioned across my contracts?" },
  ];
  const alerts = insights?.alerts || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--ink-3)" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>Chat with your documents</h1>
          <p style={{ fontSize: 12, color: "var(--ink-8)", marginTop: 4 }}>Ask anything. Answers cite the files they came from.</p>
        </div>
        <button
          onClick={() => { setMessages([]); fetch(`${API_BASE}/api/chat/history`, { method: "DELETE" }); }}
          disabled={messages.length === 0}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 13px", fontSize: 13, fontWeight: 500, borderRadius: 7,
            background: "transparent", border: "none", color: "var(--ink-8)",
            cursor: messages.length ? "pointer" : "not-allowed",
            opacity: messages.length ? 1 : 0.45,
          }}
        >
          <Trash2 size={14} /> Clear history
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "20px 0", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760, width: "100%", margin: "0 auto" }}>
        {messages.length === 0 ? (
          <>
            {/* Empty state */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 0" }}>
              <img src="/glyph.svg" width={48} height={48} alt="" />
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>What do you want to know?</div>
              <div style={{ fontSize: 13, color: "var(--ink-8)" }}>Your documents are ready.</div>
            </div>

            {/* Insights */}
            {alerts.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-7)", marginBottom: 8 }}>For your attention</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(alerts.length, 3)}, 1fr)`, gap: 8 }}>
                  {alerts.slice(0, 3).map((al: any, i: number) => {
                    const tone = al.severity === "high"
                      ? { fg: "var(--dv-danger)", bg: "var(--dv-danger-bg)", bd: "oklch(0.68 0.20 25 / 0.4)" }
                      : al.severity === "medium"
                      ? { fg: "var(--dv-warning)", bg: "var(--dv-warning-bg)", bd: "oklch(0.80 0.15 78 / 0.4)" }
                      : { fg: "var(--dv-info)", bg: "var(--dv-info-bg)", bd: "oklch(0.72 0.13 220 / 0.4)" };
                    const ToneIcon = al.severity === "high" ? AlertCircle : al.severity === "medium" ? AlertTriangle : Info;
                    return (
                      <div key={i} style={{ padding: 12, borderRadius: 7, background: tone.bg, border: `1px solid ${tone.bd}` }}>
                        <ToneIcon size={14} color={tone.fg} />
                        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6, color: "var(--ink-10)" }}>{al.message}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Starters */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-7)", marginBottom: 8 }}>Try asking</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {starters.map((s) => (
                  <button key={s.q} onClick={() => handleSend(s.q)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                      background: "var(--ink-2)", border: "1px solid var(--ink-4)", borderRadius: 7,
                      cursor: "pointer", color: "var(--ink-10)", fontSize: 13, textAlign: "left",
                      transition: `background var(--dur-base) var(--ease-out)`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-3)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-2)"; }}
                  >
                    <s.icon size={14} color="var(--ink-8)" />
                    <span style={{ flex: 1 }}>{s.q}</span>
                    <ArrowUpRight size={12} color="var(--ink-7)" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "user" ? (
                  <div style={{
                    maxWidth: "78%", padding: "10px 14px", borderRadius: 10,
                    background: "var(--accent-700)", color: "oklch(0.99 0.002 264)",
                    fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: 4,
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <div style={{
                    maxWidth: "82%", padding: "12px 16px", borderRadius: 10,
                    background: "var(--ink-2)", border: "1px solid var(--ink-4)",
                    color: "var(--ink-10)", fontSize: 13, lineHeight: 1.55,
                    borderBottomLeftRadius: 4,
                  }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--ink-3)" }}>
                        {msg.sources.map((src) => {
                          const c = categoryColor(src.category || "Other");
                          return (
                            <button key={src.id}
                              onClick={() => fetch(`${API_BASE}/api/documents/${src.id}/open`)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "3px 8px", borderRadius: 7,
                                background: "var(--ink-3)", border: "1px solid var(--ink-5)",
                                fontSize: 11, color: "var(--ink-9)", cursor: "pointer",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />
                              {src.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {mutation.isPending && (
              <div style={{ display: "flex" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10, borderBottomLeftRadius: 4,
                  background: "var(--ink-2)", border: "1px solid var(--ink-4)",
                  fontSize: 12, color: "var(--ink-8)",
                }}>
                  <span className="dv-dots"><span /><span /><span /></span> Reading your documents...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--ink-3)", padding: "12px 0 0", background: "var(--ink-1)", margin: "0 -24px", paddingLeft: 24, paddingRight: 24 }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: 760, margin: "0 auto" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
            background: "var(--ink-2)", border: "1px solid var(--ink-4)", borderRadius: 7,
            boxShadow: "var(--shadow-inset-top)", height: 42,
          }}>
            <Paperclip size={14} color="var(--ink-7)" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your documents..."
              disabled={mutation.isPending}
              autoFocus
              style={{
                flex: 1, background: "transparent", border: 0, outline: 0,
                color: "var(--ink-10)", fontFamily: "var(--font-sans)", fontSize: 14,
              }}
            />
            <kbd style={{ fontSize: 10 }}>Enter</kbd>
          </div>
          <button type="submit" disabled={!input.trim() || mutation.isPending} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "0 16px", height: 42, borderRadius: 7,
            background: "var(--accent-500)", color: "oklch(0.99 0.002 264)",
            border: "1px solid var(--accent-700)", fontSize: 13, fontWeight: 500,
            cursor: input.trim() ? "pointer" : "not-allowed",
            opacity: input.trim() ? 1 : 0.45,
            boxShadow: "var(--shadow-inset-top)",
          }}>
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
          </button>
        </form>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-7)", marginTop: 8, paddingBottom: 12, maxWidth: 760, margin: "8px auto 0" }}>
          Files stay on your disk. Only metadata and snippets are sent for AI classification.
        </div>
      </div>
    </div>
  );
}
