"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DocumentCard } from "@/components/document-card";
import { PreviewPanel } from "@/components/preview-panel";
import { BatchToolbar } from "@/components/batch-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, PanelRightOpen, PanelRightClose } from "lucide-react";
import { toast } from "sonner";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}>
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;
  const [offset, setOffset] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(-1);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["documents", category, offset],
    queryFn: () => api.documents.list({ category, offset, limit }),
  });

  const docs = data?.documents || [];

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setFocusIndex((i) => {
            const next = Math.min(i + 1, docs.length - 1);
            if (docs[next]) setSelectedDoc(docs[next].id);
            return next;
          });
          break;
        case "k":
          e.preventDefault();
          setFocusIndex((i) => {
            const next = Math.max(i - 1, 0);
            if (docs[next]) setSelectedDoc(docs[next].id);
            return next;
          });
          break;
        case "p":
          e.preventDefault();
          setShowPreview((v) => !v);
          break;
        case "o":
          if (selectedDoc) { e.preventDefault(); api.documents.open(selectedDoc); }
          break;
        case "f":
          if (selectedDoc) { e.preventDefault(); api.documents.reveal(selectedDoc); }
          break;
        case "d":
          if (selectedDoc) {
            e.preventDefault();
            api.documents.delete(selectedDoc).then(() => { toast.success("Deleted"); refetch(); });
          }
          break;
        case "r":
          if (selectedDoc) {
            e.preventDefault();
            api.documents.reclassify(selectedDoc).then(() => { toast.success("Reclassified"); refetch(); });
          }
          break;
        case "Escape":
          setSelectedDoc(null);
          setShowPreview(false);
          setSelectedIds([]);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [docs, selectedDoc, refetch]);

  const handleDelete = async (id: string) => {
    await api.documents.delete(id);
    toast.success("Document deleted");
    refetch();
  };

  const handleReclassify = async (id: string) => {
    const result = await api.documents.reclassify(id);
    toast.success(`Reclassified as: ${result.category} / ${result.subcategory}`);
    refetch();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex gap-0 -m-6">
      <div className={`flex-1 p-6 space-y-4 ${showPreview && selectedDoc ? "max-w-[calc(100%-24rem)]" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {category ? `${category} Documents` : "All Documents"}
            </h1>
            <p className="text-muted-foreground">
              {data ? `${data.total} documents` : "Loading..."} &middot;
              <span className="text-xs ml-1">J/K navigate, P preview, O open</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>

        <BatchToolbar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />

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
              {docs.map((doc, i) => (
                <div
                  key={doc.id}
                  className={`relative ${
                    selectedDoc === doc.id ? "ring-2 ring-primary rounded-lg" : ""
                  } ${focusIndex === i ? "ring-1 ring-primary/50 rounded-lg" : ""}`}
                  onClick={() => {
                    setSelectedDoc(doc.id);
                    setFocusIndex(i);
                  }}
                >
                  {/* Checkbox for batch select */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      className="h-4 w-4 rounded border-muted-foreground/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="pl-8">
                    <DocumentCard
                      doc={doc}
                      onDelete={handleDelete}
                      onReclassify={handleReclassify}
                    />
                  </div>
                </div>
              ))}
            </div>

            {data.total > limit && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {offset + 1} - {Math.min(offset + limit, data.total)} of {data.total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= data.total}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {docs.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No documents found. Upload some files to get started.
              </p>
            )}
          </>
        )}
      </div>

      {/* Split-pane preview */}
      {showPreview && selectedDoc && (
        <PreviewPanel docId={selectedDoc} onClose={() => { setShowPreview(false); setSelectedDoc(null); }} />
      )}
    </div>
  );
}
