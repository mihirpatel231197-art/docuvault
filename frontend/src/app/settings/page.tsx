"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import { useTheme } from "@/components/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderOpen, Scan, Loader2, CheckCircle, HardDrive, Brain, Keyboard,
  Sun, Moon, Monitor, Database, Download, Upload, Shield, Puzzle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [scanPath, setScanPath] = useState("");
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: folders } = useQuery({ queryKey: ["watched-folders"], queryFn: api.watchedFolders });
  const { data: aiStatus } = useQuery({ queryKey: ["ai-status"], queryFn: api.ai.status });
  const { data: shortcuts } = useQuery({ queryKey: ["shortcuts"], queryFn: api.settings.shortcuts });
  const { data: backups } = useQuery({ queryKey: ["backups"], queryFn: api.db.backups });
  const { data: plugins } = useQuery({ queryKey: ["plugins"], queryFn: api.plugins.list });
  const { data: diagnostics } = useQuery({ queryKey: ["diagnostics"], queryFn: api.diagnostics });

  const preview = useMutation({ mutationFn: (dir: string) => api.scan(dir, true) });
  const scan = useMutation({
    mutationFn: (dir: string) => api.scan(dir, false),
    onSuccess: (data) => {
      toast.success(`Scan complete: ${data.indexed} indexed, ${data.skipped} skipped`);
      queryClient.invalidateQueries({ queryKey: ["watched-folders"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => toast.error(`Scan failed: ${err instanceof Error ? err.message : "Unknown"}`),
  });

  const backup = useMutation({
    mutationFn: api.db.backup,
    onSuccess: (d) => {
      toast.success(`Backup created: ${formatBytes(d.size_bytes)}`);
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage folders, AI, appearance, and backups</p>
      </div>

      <Tabs defaultValue="folders">
        <TabsList>
          <TabsTrigger value="folders">Folders</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="folders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Scan a Folder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="/Volumes/Mihir-SSD or ~/Documents"
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" disabled={!scanPath || preview.isPending} onClick={() => preview.mutate(scanPath)}>
                  {preview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
                </Button>
                <Button disabled={!scanPath || scan.isPending} onClick={() => scan.mutate(scanPath)}>
                  {scan.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scanning...</> : <><Scan className="h-4 w-4 mr-2" />Scan & Index</>}
                </Button>
              </div>

              {preview.data && (
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-sm"><strong>{preview.data.total}</strong> files found in <code className="text-xs bg-muted px-1 py-0.5 rounded">{scanPath}</code></p>
                </div>
              )}

              {scan.data && !scan.data.dry_run && (
                <div className="p-3 rounded-md bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Scan complete</p>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-green-700 dark:text-green-300">
                    <span>Indexed: {scan.data.indexed}</span>
                    <span>Skipped: {scan.data.skipped}</span>
                    <span>Failed: {scan.data.failed}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" />Watched Folders</CardTitle>
            </CardHeader>
            <CardContent>
              {folders && folders.length > 0 ? (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div key={folder.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium font-mono">{folder.path}</p>
                          <p className="text-xs text-muted-foreground">
                            {folder.file_count} files &middot; Last scan: {folder.last_scan ? formatDate(folder.last_scan) : "Never"}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setScanPath(folder.path); scan.mutate(folder.path); }}>
                        Rescan
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No folders scanned yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Claude API</span>
                <Badge variant={aiStatus?.claude ? "default" : "outline"}>
                  {aiStatus?.claude ? "Connected" : "Not configured"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Ollama (Offline)</span>
                <Badge variant={aiStatus?.ollama ? "default" : "outline"}>
                  {aiStatus?.ollama ? "Running" : "Not running"}
                </Badge>
              </div>
              {aiStatus?.ollama && aiStatus.ollama_models.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Available models:</span>
                  <div className="flex gap-1 mt-1">
                    {aiStatus.ollama_models.map((m) => (
                      <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Backend</span>
                <Badge variant="secondary">{aiStatus?.active_backend || "none"}</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Monitor, "System"]] as const).map(([t, Icon, label]) => (
                  <Button
                    key={t}
                    variant={theme === t ? "default" : "outline"}
                    onClick={() => setTheme(t)}
                    className="flex-1"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Keyboard className="h-5 w-5" />Keyboard Shortcuts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {shortcuts?.map((s) => (
                  <div key={s.action} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm">{s.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border">
                      {s.key_combo.replace("mod+", "Cmd+")}
                    </kbd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Database Backup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => backup.mutate()} disabled={backup.isPending}>
                {backup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Create Backup
              </Button>

              {backups && backups.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recent Backups</h4>
                  {backups.map((b) => (
                    <div key={b.path} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                      <span className="font-mono text-xs">{b.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatBytes(b.size_bytes)} &middot; {formatDate(b.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plugins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Puzzle className="h-5 w-5" />Plugins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plugins?.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.builtin && <Badge variant="outline" className="text-xs">Built-in</Badge>}
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Diagnostics</CardTitle>
            </CardHeader>
            <CardContent>
              {diagnostics && (
                <div className="space-y-2 text-xs font-mono">
                  <p>Documents: {(diagnostics as any).document_count}</p>
                  <p>Storage: {formatBytes((diagnostics as any).total_size_bytes || 0)}</p>
                  <p>DB: {(diagnostics as any).db_path}</p>
                  <p>DB Size: {formatBytes((diagnostics as any).db_size_bytes || 0)}</p>
                  <p>Python: {(diagnostics as any).python_version}</p>
                  <p>Platform: {(diagnostics as any).platform}</p>
                  {(diagnostics as any).dependencies && (
                    <div className="mt-2">
                      <p className="font-semibold">Dependencies:</p>
                      {Object.entries((diagnostics as any).dependencies).map(([k, v]) => (
                        <p key={k} className={v === "installed" ? "text-green-600" : "text-red-500"}>
                          {k}: {v as string}
                        </p>
                      ))}
                    </div>
                  )}
                  {(diagnostics as any).services && (
                    <div className="mt-2">
                      <p className="font-semibold">Services:</p>
                      {Object.entries((diagnostics as any).services).map(([k, v]) => (
                        <p key={k} className={v === "running" ? "text-green-600" : "text-muted-foreground"}>
                          {k}: {v as string}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
