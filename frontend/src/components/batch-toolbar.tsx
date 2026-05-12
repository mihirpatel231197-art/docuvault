"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Trash2, Archive, RotateCcw, Tag, X, CheckSquare,
} from "lucide-react";
import { toast } from "sonner";

export function BatchToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    onClear();
  };

  const batchDelete = useMutation({
    mutationFn: () => api.batch.delete(selectedIds),
    onSuccess: (d) => { toast.success(`Deleted ${d.deleted} documents`); invalidate(); },
  });

  const batchArchive = useMutation({
    mutationFn: () => api.batch.archive(selectedIds),
    onSuccess: (d) => { toast.success(`Archived ${d.archived} documents`); invalidate(); },
  });

  const batchReclassify = useMutation({
    mutationFn: () => api.batch.reclassify(selectedIds),
    onSuccess: (d) => { toast.success(`Reclassified ${d.reclassified.length} documents`); invalidate(); },
  });

  const batchRetag = useMutation({
    mutationFn: (tags: string[]) => api.batch.retag(selectedIds, tags, "add"),
    onSuccess: (d) => { toast.success(`Retagged ${d.updated} documents`); invalidate(); setShowTagInput(false); setTagInput(""); },
  });

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-primary text-primary-foreground rounded-lg p-3 flex items-center gap-3 shadow-lg">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4" />
        <span className="text-sm font-medium">{selectedIds.length} selected</span>
      </div>

      <div className="flex-1 flex items-center gap-2">
        {showTagInput ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (tagInput.trim()) {
                batchRetag.mutate(tagInput.split(",").map((t) => t.trim()));
              }
            }}
          >
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="tag1, tag2, ..."
              className="h-7 text-xs w-48 bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
              autoFocus
            />
            <Button size="sm" variant="secondary" className="h-7 text-xs" type="submit">
              Apply
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTagInput(false)}>
              <X className="h-3 w-3" />
            </Button>
          </form>
        ) : (
          <>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setShowTagInput(true)}>
              <Tag className="h-3 w-3 mr-1" />
              Tag
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => batchReclassify.mutate()}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reclassify
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => batchArchive.mutate()}>
              <Archive className="h-3 w-3 mr-1" />
              Archive
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => batchDelete.mutate()}>
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </>
        )}
      </div>

      <Button size="sm" variant="ghost" className="h-7" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
