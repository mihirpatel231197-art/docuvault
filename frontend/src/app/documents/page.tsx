"use client";

import { useState, useMemo, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import { PageHeader, Card, Btn, IconBtn, FileTypeIcon, CategoryBadge, ConfidenceBadge, EmptyState } from "@/components/ds";
import { Filter, FolderPlus, LayoutGrid, List, ExternalLink, Folder, RefreshCw, Trash2, ChevronLeft, ChevronRight, Files } from "lucide-react";
import { toast } from "sonner";

export default function DocumentsPage() {
  return <Suspense fallback={null}><DocumentsInner /></Suspense>;
}

function DocumentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cat = searchParams.get("category");
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list"|"grid">("list");
  const [sort, setSort] = useState<"date"|"name"|"size">("date");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["documents", cat, sort, offset],
    queryFn: () => api.documents.list({ category: cat||undefined, offset, limit }),
  });

  const deleteMut = useMutation({
    mutationFn: (id:string) => api.documents.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:["documents"]}); toast.success("Deleted"); },
  });
  const reclassify = useMutation({
    mutationFn: (id:string) => api.documents.reclassify(id),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:["documents"]}); toast.success("Reclassified"); },
  });

  const docs = useMemo(() => {
    const arr = [...(data?.documents||[])];
    if(sort==="name") arr.sort((a,b)=>a.title.localeCompare(b.title));
    else if(sort==="size") arr.sort((a,b)=>(b.file_size||0)-(a.file_size||0));
    return arr;
  }, [data, sort]);
  const total = data?.total || 0;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <PageHeader
        title={cat||"All documents"}
        subtitle={`${total.toLocaleString()} documents${cat?"":" across all categories"}`}
        actions={<>
          <Btn icon={<Filter size={14}/>} variant="ghost">Filter</Btn>
          <Btn icon={<FolderPlus size={14}/>} variant="primary" onClick={()=>router.push("/settings")}>Scan a folder</Btn>
        </>}
      />

      {/* Filter bar */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 24px",borderBottom:"1px solid var(--border-faint)",background:"var(--bg-canvas)",flexShrink:0}}>
        {cat&&<SelectChip label="Category" value={cat} onClear={()=>router.push("/documents")}/>}
        <SelectChipSort value={sort} onChange={setSort}/>
        <div style={{flex:1}}/>
        <ViewToggle view={view} onChange={setView}/>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:view==="list"?"8px 16px 24px":"20px 24px"}}>
        {isLoading && <div style={{padding:48,textAlign:"center",color:"var(--fg-muted)",fontSize:13}}>Loading…</div>}
        {!isLoading && docs.length===0 && (
          <EmptyState icon={<Files size={28} strokeWidth={1.3}/>} title="Nothing indexed yet."
            description="DocuVault doesn't move or upload your files. Point it at a folder and it'll start cataloguing."
            action={<Btn variant="primary" icon={<FolderPlus size={14}/>} onClick={()=>router.push("/settings")}>Scan a folder</Btn>}
          />
        )}
        {view==="list"
          ?<div style={{display:"flex",flexDirection:"column",gap:4}}>{docs.map(d=><DocRow key={d.id} doc={d} onDelete={()=>deleteMut.mutate(d.id)} onReclassify={()=>reclassify.mutate(d.id)}/>)}</div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>{docs.map(d=><DocCard key={d.id} doc={d}/>)}</div>
        }
        {total>limit&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:24,paddingTop:12,borderTop:"1px solid var(--border-faint)"}}>
            <div style={{fontSize:12,color:"var(--fg-tertiary)"}}>Showing {offset+1}–{Math.min(offset+limit,total)} of {total}</div>
            <div style={{display:"flex",gap:6}}>
              <Btn size="sm" variant="ghost" icon={<ChevronLeft size={12}/>} disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-limit))}>Prev</Btn>
              <Btn size="sm" variant="ghost" icon={<ChevronRight size={12}/>} disabled={offset+limit>=total} onClick={()=>setOffset(offset+limit)}>Next</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectChip({label,value,onClear}:{label:string;value:string;onClear?:()=>void}) {
  return <div style={{display:"inline-flex",alignItems:"center",gap:8,height:30,padding:"0 10px",background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",fontSize:12,cursor:"pointer",color:"var(--fg-secondary)"}}>
    <span style={{color:"var(--fg-muted)"}}>{label}:</span>
    <span style={{color:"var(--fg-primary)"}}>{value}</span>
    {onClear&&<span onClick={onClear} style={{color:"var(--fg-muted)",cursor:"pointer",lineHeight:1}}>×</span>}
  </div>;
}

function SelectChipSort({value,onChange}:{value:string;onChange:(v:any)=>void}) {
  const opts=[{v:"date",l:"Recently indexed"},{v:"name",l:"Name (A→Z)"},{v:"size",l:"Size (largest)"}];
  const label=opts.find(o=>o.v===value)?.l||"Sort";
  return <div style={{display:"inline-flex",alignItems:"center",gap:8,height:30,padding:"0 10px",background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",fontSize:12,cursor:"pointer",color:"var(--fg-secondary)"}}>
    <span style={{color:"var(--fg-muted)"}}>Sort:</span>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{background:"transparent",border:0,color:"var(--fg-primary)",fontSize:12,cursor:"pointer",outline:"none"}}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
  </div>;
}

function ViewToggle({view,onChange}:{view:string;onChange:(v:any)=>void}) {
  return <div style={{display:"inline-flex",padding:2,background:"var(--ink-3)",borderRadius:"var(--radius-md)",border:"1px solid var(--ink-5)"}}>
    {[{id:"list",icon:<List size={13}/>},{id:"grid",icon:<LayoutGrid size={13}/>}].map(o=>(
      <button key={o.id} onClick={()=>onChange(o.id)} style={{width:28,height:24,display:"grid",placeItems:"center",background:view===o.id?"var(--bg-card)":"transparent",border:"none",color:view===o.id?"var(--fg-primary)":"var(--fg-muted)",borderRadius:"calc(var(--radius-md) - 2px)",cursor:"pointer"}}>{o.icon}</button>
    ))}
  </div>;
}

function DocRow({doc,onDelete,onReclassify}:{doc:any;onDelete:()=>void;onReclassify:()=>void}) {
  const [hover,setHover]=useState(false);
  return <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
    style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",borderRadius:"var(--radius-md)",background:hover?"var(--bg-card)":"transparent",cursor:"pointer",border:hover?"1px solid var(--border-default)":"1px solid transparent",transition:"background 160ms"}}>
    <FileTypeIcon mime={doc.mime_type} size={32}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{fontSize:13,fontWeight:500,color:"var(--fg-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.title}</div>
        {doc.category&&<CategoryBadge name={doc.category} size="sm"/>}
        {doc.subcategory&&<span style={{fontSize:11,color:"var(--fg-muted)"}}>{doc.subcategory}</span>}
      </div>
      <div style={{fontSize:12,color:"var(--fg-tertiary)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.summary}</div>
      <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--fg-muted)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.file_path}</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,fontSize:11,color:"var(--fg-tertiary)",flexShrink:0,width:120,whiteSpace:"nowrap"}}>
      <span style={{fontFamily:"var(--font-mono)"}}>{doc.file_size?formatBytes(doc.file_size):"–"}</span>
      <span>{doc.indexed_at?formatDate(doc.indexed_at):"–"}</span>
    </div>
    {doc.ai_confidence!=null&&<ConfidenceBadge value={doc.ai_confidence}/>}
    <div style={{display:"flex",gap:2,opacity:hover?1:0,transition:"opacity 120ms"}}>
      <IconBtn onClick={()=>api.documents.open(doc.id)} title="Open file"><ExternalLink size={13}/></IconBtn>
      <IconBtn onClick={()=>api.documents.reveal(doc.id)} title="Reveal in Finder"><Folder size={13}/></IconBtn>
      <IconBtn onClick={onReclassify} title="Reclassify"><RefreshCw size={13}/></IconBtn>
      <IconBtn onClick={onDelete} title="Delete"><Trash2 size={13}/></IconBtn>
    </div>
  </div>;
}

function DocCard({doc}:{doc:any}) {
  return <Card padding={0} hoverable>
    <div style={{aspectRatio:"4/3",background:"var(--ink-1)",borderTopLeftRadius:"var(--radius-lg)",borderTopRightRadius:"var(--radius-lg)",display:"grid",placeItems:"center",borderBottom:"1px solid var(--border-faint)"}}>
      <FileTypeIcon mime={doc.mime_type} size={48}/>
    </div>
    <div style={{padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        {doc.category&&<CategoryBadge name={doc.category} size="sm"/>}
        {doc.ai_confidence!=null&&<ConfidenceBadge value={doc.ai_confidence}/>}
      </div>
      <div style={{fontSize:13,fontWeight:500,marginTop:8,lineHeight:1.35,color:"var(--fg-primary)"}}>{doc.title}</div>
      <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--fg-muted)",marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.file_path}</div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:11,color:"var(--fg-tertiary)"}}>
        <span style={{fontFamily:"var(--font-mono)"}}>{doc.file_size?formatBytes(doc.file_size):"–"}</span>
        <span>{doc.indexed_at?formatDate(doc.indexed_at):"–"}</span>
      </div>
    </div>
  </Card>;
}
