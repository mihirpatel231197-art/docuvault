"use client";

import { UploadZone } from "@/components/upload-zone";
import { UploadCloud, FileSearch2, Sparkles, Search } from "lucide-react";

const steps = [
  { icon: UploadCloud, label: "Upload", desc: "Drag files into the zone above." },
  { icon: FileSearch2, label: "Extract", desc: "Text extracted; OCR runs on scans." },
  { icon: Sparkles, label: "Classify", desc: "Claude assigns category, tags, dates." },
  { icon: Search, label: "Searchable", desc: "Indexed in SQLite, ready to query." },
];

export default function UploadPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: "1px solid var(--ink-3)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>Upload</h1>
        <p style={{ fontSize: 12, color: "var(--ink-8)", marginTop: 4 }}>Drop files to index them without adding a watched folder.</p>
      </div>

      <UploadZone />

      {/* Pipeline */}
      <div style={{ background: "var(--ink-2)", border: "1px solid var(--ink-4)", borderRadius: 10, boxShadow: "var(--shadow-inset-top)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid var(--ink-3)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-10)" }}>How it works</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: 16, gap: 12 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              position: "relative", padding: "14px 14px 12px",
              background: "var(--ink-1)", border: "1px solid var(--ink-3)",
              borderRadius: 7,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "var(--ink-3)", display: "grid", placeItems: "center",
                color: "var(--ink-9)",
              }}>
                <s.icon size={14} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 10, color: "var(--ink-10)" }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "var(--ink-8)", marginTop: 4, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
