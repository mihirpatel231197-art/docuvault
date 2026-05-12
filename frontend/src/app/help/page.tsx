"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, Keyboard, Info } from "lucide-react";

export default function HelpPage() {
  const { data: help, isLoading } = useQuery({
    queryKey: ["help"],
    queryFn: api.help,
  });

  const { data: shortcuts } = useQuery({
    queryKey: ["shortcuts"],
    queryFn: api.settings.shortcuts,
  });

  const { data: version } = useQuery({
    queryKey: ["version"],
    queryFn: api.version,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Help Center</h1>
          <p className="text-muted-foreground">Learn how to use DocuVault</p>
        </div>
        {version && (
          <Badge variant="outline" className="text-xs">
            v{version.version} ({version.platform})
          </Badge>
        )}
      </div>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

      {/* Documentation */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {help?.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5" />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.items.map((item) => (
              <div key={item.title}>
                <h4 className="font-medium text-sm mb-1">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5" />
            System Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-1 font-mono">
            {version && (
              <>
                <p>Version: {version.version}</p>
                <p>Build: {version.build}</p>
                <p>Platform: {version.platform}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
