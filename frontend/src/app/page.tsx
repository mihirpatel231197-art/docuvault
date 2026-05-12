"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatBytes, categoryColor } from "@/lib/utils";
import { UploadZone } from "@/components/upload-zone";
import {
  Files, HardDrive, Tags, AlertCircle, MessageSquare, FolderPlus,
  ArrowUpRight, Scan, Search,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ["stats"],
    queryFn: api.stats,
  });

  const { data: insights } = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200"}/api/insights`).then(r => r.json()),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (stats && stats.total_documents === 0) setShowOnboarding(true);
  }, [stats]);

  if (showOnboarding && stats?.total_documents === 0) {
    return <OnboardingFlow onComplete={() => { setShowOnboarding(false); refetch(); }} />;
  }

  const cats = stats?.categories
    ? Object.entries(stats.categories).sort(([, a], [, b]) => b - a)
    : [];
  const maxCat = Math.max(...cats.map(([, c]) => c), 1);
  const alerts = insights?.alerts || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--ink-3)" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "var(--ink-8)", marginTop: 4 }}>Overview of your indexed documents.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <DesignButton variant="secondary" icon={MessageSquare} onClick={() => router.push("/chat")}>Open chat</DesignButton>
          <DesignButton variant="primary" icon={FolderPlus} onClick={() => router.push("/settings")}>Scan a folder</DesignButton>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard icon={Files} label="Total documents" value={stats?.total_documents?.toLocaleString() ?? "0"} />
        <StatCard icon={HardDrive} label="Storage indexed" value={stats ? formatBytes(stats.total_size_bytes) : "0 B"} sub={`across ${stats?.watched_folders ?? 0} watched folders`} />
        <StatCard icon={Tags} label="Categories" value={String(cats.length)} sub="auto-derived by AI" />
        <StatCard icon={AlertCircle} label="Pending review" value={String(stats?.pending_review ?? 0)} sub="< 50% confidence" intent="warning" />
      </div>

      {/* Insights + categories */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        {/* Insights */}
        <DvCard>
          <CardHeader title="Proactive insights" />
          <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.length > 0 ? alerts.slice(0, 4).map((alert: any, i: number) => (
              <InsightRow key={i} alert={alert} />
            )) : (
              <div style={{ fontSize: 13, color: "var(--ink-8)", padding: 12, textAlign: "center" }}>
                No alerts right now.
              </div>
            )}
          </div>
        </DvCard>

        {/* Category breakdown */}
        <DvCard>
          <CardHeader title="Category breakdown" />
          <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {cats.slice(0, 8).map(([name, count]) => {
              const c = categoryColor(name);
              const pct = (count / maxCat) * 100;
              return (
                <button key={name} onClick={() => router.push(`/documents?category=${name}`)}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "transparent", border: "none", color: "inherit", width: "100%", textAlign: "left" }}>
                  <span style={{ width: 90, fontSize: 12, color: "var(--ink-9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--ink-3)", overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${pct}%`, height: "100%", background: c.fg, borderRadius: 999, transition: "width 320ms" }} />
                  </span>
                  <span style={{ width: 40, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-8)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                </button>
              );
            })}
          </div>
        </DvCard>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <QuickAction icon={Search} title="Search documents" desc="Find any document instantly." onClick={() => router.push("/search")} />
        <QuickAction icon={MessageSquare} title="Chat with docs" desc="Ask AI about your files." onClick={() => router.push("/chat")} />
        <QuickAction icon={Scan} title="Scan a folder" desc="Index files with AI classification." onClick={() => router.push("/settings")} />
      </div>
    </div>
  );
}

// ── Design system primitives ──

function DvCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--ink-2)", border: "1px solid var(--ink-4)", borderRadius: 10,
      boxShadow: "var(--shadow-inset-top)", overflow: "hidden", ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 18px 10px", borderBottom: "1px solid var(--ink-3)",
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-10)" }}>{title}</span>
      {hint && <span style={{ fontSize: 11, color: "var(--ink-7)" }}>{hint}</span>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, intent }: {
  icon: React.ComponentType<{ size: number; strokeWidth?: number }>; label: string; value: string; sub?: string; intent?: string;
}) {
  return (
    <DvCard style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-8)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <Icon size={13} strokeWidth={1.5} />
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 8, fontVariantNumeric: "tabular-nums", color: "var(--ink-10)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-8)", marginTop: 6 }}>{sub}</div>}
    </DvCard>
  );
}

function InsightRow({ alert }: { alert: { severity: string; message: string; details?: any } }) {
  const tones: Record<string, { bg: string; bd: string; icon: string }> = {
    high: { bg: "var(--dv-danger-bg)", bd: "oklch(0.68 0.20 25 / 0.4)", icon: "alert-circle" },
    medium: { bg: "var(--dv-warning-bg)", bd: "oklch(0.80 0.15 78 / 0.4)", icon: "alert-triangle" },
    low: { bg: "var(--dv-info-bg)", bd: "oklch(0.72 0.13 220 / 0.4)", icon: "info" },
  };
  const tone = tones[alert.severity] || tones.low;
  return (
    <div style={{ padding: "10px 12px", borderRadius: 7, background: tone.bg, border: `1px solid ${tone.bd}` }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-10)" }}>{alert.message}</div>
      {alert.details && Array.isArray(alert.details) && (
        <div style={{ fontSize: 11, color: "var(--ink-8)", marginTop: 2 }}>
          {alert.details.slice(0, 2).map((d: any, i: number) => (
            <div key={i}>{d.title}{d.date ? ` \u2014 ${d.date}` : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, title, desc, onClick }: {
  icon: React.ComponentType<{ size: number }>; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 16px", borderRadius: 10, textAlign: "left",
        background: "var(--ink-2)", border: "1px solid var(--ink-4)",
        boxShadow: "var(--shadow-inset-top)", cursor: "pointer",
        transition: `background var(--dur-base) var(--ease-out)`,
        color: "inherit",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-3)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-2)"; }}
    >
      <Icon size={16} />
      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8, color: "var(--ink-10)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--ink-8)", marginTop: 2 }}>{desc}</div>
    </button>
  );
}

function DesignButton({ variant, icon: Icon, children, onClick }: {
  variant: "primary" | "secondary"; icon?: React.ComponentType<{ size: number }>; children: React.ReactNode; onClick?: () => void;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--accent-500)", color: "oklch(0.99 0.002 264)",
      borderColor: "var(--accent-700)", boxShadow: "var(--shadow-inset-top)",
    },
    secondary: {
      background: "var(--ink-3)", color: "var(--ink-10)",
      borderColor: "var(--ink-5)", boxShadow: "var(--shadow-inset-top)",
    },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "7px 13px", fontSize: 13, fontWeight: 500,
      borderRadius: 7, border: "1px solid", cursor: "pointer",
      transition: `all var(--dur-base) var(--ease-out)`,
      fontFamily: "var(--font-sans)",
      ...styles[variant],
    }}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [scanPath, setScanPath] = useState("");

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <DvCard style={{ width: "100%", maxWidth: 580, padding: 0 }}>
        <div style={{ padding: "48px 40px", textAlign: "center" }}>
          <img src="/glyph.svg" width={48} height={48} alt="" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-10)" }}>
            Welcome to DocuVault
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-8)", marginTop: 8, maxWidth: 400, margin: "8px auto 24px" }}>
            Point DocuVault at a folder. It reads, classifies, and indexes every file with AI. Files stay where they are.
          </p>
          <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto" }}>
            <input
              type="text"
              placeholder="~/Documents or /Volumes/External-Drive"
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              style={{
                flex: 1, padding: "0 12px", height: 32, borderRadius: 5,
                background: "var(--ink-2)", border: "1px solid var(--ink-4)",
                color: "var(--ink-10)", fontFamily: "var(--font-mono)", fontSize: 12,
                outline: "none",
              }}
            />
            <DesignButton variant="primary" icon={Scan} onClick={async () => {
              if (scanPath) {
                try { await api.scan(scanPath, false); } catch {}
                onComplete();
              }
            }}>Scan</DesignButton>
          </div>
          <button onClick={onComplete} style={{
            marginTop: 16, background: "transparent", border: "none",
            color: "var(--ink-7)", fontSize: 12, cursor: "pointer",
          }}>
            Skip for now
          </button>
        </div>
      </DvCard>
    </div>
  );
}
