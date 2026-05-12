"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DocumentCard } from "@/components/document-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Archive } from "lucide-react";
import { toast } from "sonner";

export default function ArchivePage() {
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["documents", "archived", offset],
    queryFn: () =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200"}/api/documents?is_archived=1&offset=${offset}&limit=${limit}`)
        .then((r) => r.json()),
  });

  const handleRestore = async (id: string) => {
    await api.documents.update(id, { is_archived: false } as any);
    toast.success("Document restored");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Archive className="h-6 w-6" />
          Archive
        </h1>
        <p className="text-muted-foreground">
          {data ? `${data.total} archived documents` : "Loading..."}
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="space-y-3">
            {data.documents?.map((doc: any) => (
              <div key={doc.id} className="relative">
                <DocumentCard doc={doc} onDelete={() => handleRestore(doc.id)} />
              </div>
            ))}
          </div>

          {data.documents?.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              No archived documents
            </p>
          )}

          {data.total > limit && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1} - {Math.min(offset + limit, data.total)} of {data.total}
              </span>
              <Button variant="outline" size="sm" disabled={offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
