"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SmartFolder } from "@/lib/api";
import { DocumentCard } from "@/components/document-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderSearch, Plus, ChevronRight, ChevronLeft, Clock, HardDrive,
  AlertCircle, Image, FileText, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "clock": Clock,
  "hard-drive": HardDrive,
  "alert-circle": AlertCircle,
  "image": Image,
  "file-text": FileText,
  "folder-search": FolderSearch,
};

export default function SmartFoldersPage() {
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: folders, isLoading } = useQuery({
    queryKey: ["smart-folders"],
    queryFn: api.smartFolders.list,
  });

  const { data: folderDocs, isLoading: loadingDocs } = useQuery({
    queryKey: ["smart-folder-docs", activeFolder],
    queryFn: () => api.smartFolders.documents(activeFolder!),
    enabled: !!activeFolder,
  });

  const createFolder = useMutation({
    mutationFn: () => {
      const filters: Record<string, unknown> = {};
      if (newCategory) filters.category = newCategory;
      if (newQuery) filters.query = newQuery;
      return api.smartFolders.create({ name: newName, filters });
    },
    onSuccess: () => {
      toast.success("Smart folder created");
      setShowCreate(false);
      setNewName("");
      setNewCategory("");
      setNewQuery("");
      queryClient.invalidateQueries({ queryKey: ["smart-folders"] });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => api.smartFolders.delete(id),
    onSuccess: () => {
      toast.success("Folder deleted");
      queryClient.invalidateQueries({ queryKey: ["smart-folders"] });
      setActiveFolder(null);
    },
  });

  if (activeFolder && folderDocs) {
    const folder = folders?.find((f) => f.id === activeFolder);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveFolder(null)}>
            Smart Folders
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{folder?.name || "Folder"}</span>
          <Badge variant="outline">{folderDocs.total} documents</Badge>
        </div>

        {loadingDocs && <Skeleton className="h-24 w-full" />}

        <div className="space-y-3">
          {folderDocs.documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>

        {folderDocs.documents.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No documents match this filter</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Smart Folders</h1>
          <p className="text-muted-foreground">Saved searches that auto-update</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1" />
          New Folder
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Folder name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Filter by category (optional)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Filter by keyword (optional)"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createFolder.mutate()} disabled={!newName}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {folders?.map((folder) => {
          const IconComponent = FOLDER_ICONS[folder.icon] || FolderSearch;
          return (
            <button
              key={folder.id}
              onClick={() => setActiveFolder(folder.id)}
              className="relative p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <IconComponent className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">{folder.name}</span>
              </div>
              {folder.builtin && (
                <Badge variant="outline" className="text-xs">Built-in</Badge>
              )}
              {!folder.builtin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); deleteFolder.mutate(folder.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
