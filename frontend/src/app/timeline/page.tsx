"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DocumentCard } from "@/components/document-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";

export default function TimelinePage() {
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["timeline"],
    queryFn: () => api.timeline(),
  });

  const { data: monthData, isLoading: loadingMonth } = useQuery({
    queryKey: ["timeline", selectedMonth?.year, selectedMonth?.month],
    queryFn: () => api.timeline(selectedMonth!.year, selectedMonth!.month),
    enabled: !!selectedMonth,
  });

  const handleDelete = async (id: string) => {
    await api.documents.delete(id);
    toast.success("Deleted");
  };

  if (selectedMonth && monthData?.documents) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)}>
            Timeline
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">
            {new Date(selectedMonth.year, selectedMonth.month - 1).toLocaleDateString("en-CA", { year: "numeric", month: "long" })}
          </span>
          <Badge variant="outline">{monthData.documents.length} documents</Badge>
        </div>

        <div className="space-y-3">
          {monthData.documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-muted-foreground">All documents organized by date</p>
      </div>

      {loadingOverview && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {overview?.months && (
        <div className="space-y-2">
          {overview.months.map((m) => {
            const [year, month] = m.month.split("-").map(Number);
            const label = new Date(year, month - 1).toLocaleDateString("en-CA", { year: "numeric", month: "long" });

            return (
              <button
                key={m.month}
                onClick={() => setSelectedMonth({ year, month })}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{label}</p>
                    <div className="flex gap-1 mt-1">
                      {m.categories.slice(0, 4).map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{m.count}</span>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {overview?.months?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No documents indexed yet. Scan a folder to get started.
        </p>
      )}
    </div>
  );
}
