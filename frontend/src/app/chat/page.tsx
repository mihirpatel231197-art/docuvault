"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Send, Loader2, Trash2, CalendarClock, Search as SearchIcon,
  FileText, Users, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { api } from "@/lib/api";
import { categoryColor } from "@/lib/utils";
import { PageHeader, Btn } from "@/components/ds";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ id: string; title: string; category: string }>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.stats,
    staleTime: 60_000,
  });

  const totalDocs = stats?.total_documents ?? 0;

  const mutation = useMutation({
    mutationFn: async (question: string) => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok) throw new Error("Chat failed");
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response ?? data.answer ?? "", sources: data.sources },
      ]);
    },
    onError: () => toast.error("Failed to get response"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  const handleSend = (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    mutation.mutate(text);
  };

  const clearHistory = () => {
    setMessages([]);
    fetch(`${API_BASE}/api/chat/history`, { method: "DELETE" }).catch(() => {});
  };

  const starters = [
    { icon: CalendarClock, q: "What's expiring in the next 60 days?" },
    { icon: SearchIcon, q: "Find my 2023 tax documents" },
    { icon: FileText, q: "Summarize my lease agreement" },
    { icon: Users, q: "Who is mentioned across my contracts?" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)" }}>
      <PageHeader
        title="Chat with your documents"
        actions={
          <Btn
            variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={clearHistory}
            disabled={messages.length === 0}
          >
            Clear history
          </Btn>
        }
      />

      {/* Messages / Empty state */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxWidth: 780,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {messages.length === 0 ? (
          <>
            {/* Empty state */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: "32px 0 20px",
              }}
            >
              <Image src="/glyph.svg" width={48} height={48} alt="" />
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "var(--fg-primary)",
                }}
              >
                What do you want to know?
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>
                {totalDocs > 0 ? `${totalDocs} documents indexed and ready.` : "Your documents are ready."}
              </div>
            </div>

            {/* Starter cards — 2×2 grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {starters.map((s) => (
                <button
                  key={s.q}
                  onClick={() => handleSend(s.q)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    color: "var(--fg-primary)",
                    fontSize: 13,
                    textAlign: "left",
                    transition: "background 160ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                  }}
                >
                  <s.icon size={14} color="var(--fg-tertiary)" />
                  <span style={{ flex: 1 }}>{s.q}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.role === "user" ? (
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      borderBottomRightRadius: 4,
                      background: "var(--accent-700)",
                      color: "oklch(0.99 0.002 264)",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      borderBottomLeftRadius: 4,
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      color: "var(--fg-primary)",
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: "1px solid var(--border-faint)",
                        }}
                      >
                        {msg.sources.map((src) => {
                          const c = categoryColor(src.category || "Other");
                          return (
                            <button
                              key={src.id}
                              onClick={() => fetch(`${API_BASE}/api/documents/${src.id}/open`)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "3px 8px",
                                borderRadius: 7,
                                background: "var(--ink-3)",
                                border: "1px solid var(--border-faint)",
                                fontSize: 11,
                                color: "var(--fg-secondary)",
                                cursor: "pointer",
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 999,
                                  background: c.dot,
                                  flexShrink: 0,
                                }}
                              />
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

            {/* Typing indicator */}
            {mutation.isPending && (
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 10,
                    borderBottomLeftRadius: 4,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    fontSize: 12,
                    color: "var(--fg-secondary)",
                  }}
                >
                  <span className="dv-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  Reading your documents…
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          borderTop: "1px solid var(--border-default)",
          padding: "12px 24px 16px",
          background: "var(--bg-canvas)",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-inset-top)",
              height: 44,
            }}
          >
            <Paperclip size={14} color="var(--fg-muted)" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your documents..."
              disabled={mutation.isPending}
              autoFocus
              style={{
                flex: 1,
                background: "transparent",
                border: 0,
                outline: 0,
                color: "var(--fg-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
              }}
            />
            <kbd
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 5px",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--fg-secondary)",
                background: "var(--ink-3)",
                border: "1px solid var(--ink-5)",
                borderBottomWidth: 2,
                borderRadius: "var(--radius-xs)",
                fontFamily: "var(--font-mono)",
                lineHeight: 1.4,
              }}
            >
              ↵
            </kbd>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || mutation.isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 16px",
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "var(--accent-500)",
              color: "oklch(0.99 0.002 264)",
              border: "1px solid var(--accent-700)",
              fontSize: 13,
              fontWeight: 500,
              cursor: input.trim() && !mutation.isPending ? "pointer" : "not-allowed",
              opacity: input.trim() && !mutation.isPending ? 1 : 0.45,
              boxShadow: "var(--shadow-inset-top)",
              transition: "opacity 160ms",
            }}
          >
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
