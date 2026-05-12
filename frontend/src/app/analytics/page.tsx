"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, FileText, HardDrive, Brain, Globe, Users, Building2,
  TrendingUp,
} from "lucide-react";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => api.analytics(days),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxDailyCount = Math.max(...data.daily_indexed.map((d) => d.count), 1);
  const maxCatCount = Math.max(...data.categories.map((c) => c.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Document insights and trends</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90, 365].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-3xl font-bold">{data.totals.documents}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-3xl font-bold">{formatBytes(data.totals.size_bytes)}</p>
              </div>
              <HardDrive className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-3xl font-bold">{Math.round(data.totals.avg_confidence * 100)}%</p>
              </div>
              <Brain className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Indexing Chart */}
      {data.daily_indexed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Documents Indexed Per Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {data.daily_indexed.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
                  <span className="text-xs text-muted-foreground">{d.count}</span>
                  <div
                    className="w-full bg-primary rounded-t"
                    style={{ height: `${(d.count / maxDailyCount) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                  />
                  <span className="text-xs text-muted-foreground rotate-45 origin-left">
                    {d.day.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.categories.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{cat.category}</span>
                  <span className="text-muted-foreground">{cat.count} ({formatBytes(cat.total_size)})</span>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(cat.count / maxCatCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Confidence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Confidence Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.confidence_distribution.map((cd) => {
              const color = cd.bracket.includes("high") ? "bg-green-500" :
                cd.bracket.includes("good") ? "bg-blue-500" :
                cd.bracket.includes("medium") ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={cd.bracket} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-sm flex-1">{cd.bracket}</span>
                  <span className="text-sm font-medium">{cd.count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* File Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">File Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.file_types.slice(0, 12).map((ft) => (
                <Badge key={ft.type} variant="outline" className="text-xs">
                  {ft.type.split("/").pop()} ({ft.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Languages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Languages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.languages.map((lang) => (
                <Badge key={lang.language} variant="secondary">
                  {lang.language.toUpperCase()} ({lang.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top People */}
        {data.top_people.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                People Mentioned
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.top_people.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <Badge variant="outline">{p.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Organizations */}
        {data.top_organizations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organizations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.top_organizations.map((o) => (
                <div key={o.name} className="flex items-center justify-between text-sm">
                  <span>{o.name}</span>
                  <Badge variant="outline">{o.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
