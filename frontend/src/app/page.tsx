"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { categoryColor, formatBytes, formatDate } from "@/lib/utils";
import { PageHeader, Card, CardHeader, Btn, FileTypeIcon, CategoryBadge } from "@/components/ds";
import { Files, HardDrive, Tags, AlertCircle, AlertTriangle, Info, FolderPlus, MessageSquare } from "lucide-react";
import Image from "next/image";

export default function DashboardPage() {
  const router = useRouter();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const { data: docsList } = useQuery({ queryKey: ["documents","recent"], queryFn: () => api.documents.list({ limit: 6 }) });
  const { data: analyticsData } = useQuery({ queryKey: ["analytics"], queryFn: () => api.analytics(30) });
  const { data: activityData } = useQuery({ queryKey: ["activity"], queryFn: () => api.activity({ limit: 5 }) });

  const cats = stats?.categories
    ? Object.entries(stats.categories).map(([name, count]) => ({ name, count: count as number })).sort((a,b)=>b.count-a.count)
    : [];
  const recentDocs = docsList?.documents || [];
  const totalDocs = stats?.total_documents || 0;
  const totalSize = stats?.total_size_bytes || 0;
  const avgConf = analyticsData?.totals?.avg_confidence || 0;
  const aiDocs = analyticsData?.totals?.documents || 0;
  const insights = (activityData?.activities || []).slice(0,3).map(a=>({ severity:"info" as const, message:a.description, details:a.document_title||formatDate(a.created_at) }));
  if(!insights.length) insights.push({severity:"info", message:"No recent activity.", details:"Scan a folder to get started."});

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <PageHeader title="Dashboard" subtitle="Overview of your indexed documents."
        actions={<>
          <Btn icon={<MessageSquare size={14}/>} onClick={()=>router.push("/chat")}>Open chat</Btn>
          <Btn variant="primary" icon={<FolderPlus size={14}/>} onClick={()=>router.push("/settings")}>Scan a folder</Btn>
        </>}
      />
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px 28px",display:"flex",flexDirection:"column",gap:20}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          <StatCard icon={<Files size={13}/>} label="Total documents" value={totalDocs.toLocaleString()} sub="in your index"/>
          <StatCard icon={<HardDrive size={13}/>} label="Storage indexed" value={formatBytes(totalSize)} sub={`${stats?.watched_folders||0} watched folders`}/>
          <StatCard icon={<Tags size={13}/>} label="Categories" value={cats.length.toString()} sub="auto-derived by AI"/>
          <StatCard icon={<AlertCircle size={13}/>} label="Pending review" value={(stats?.pending_review||0).toString()} sub="< 50% confidence" intent="warning"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:12}}>
          <Card padding={0}><CardHeader title="Proactive insights"/>
            <div style={{padding:"12px 18px 18px",display:"flex",flexDirection:"column",gap:8}}>
              {insights.map((a,i)=><InsightRow key={i} alert={a}/>)}
            </div>
          </Card>
          <Card padding={0}><CardHeader title="AI classification" hint={<span style={{fontFamily:"var(--font-mono)"}}>{Math.round(avgConf*100)}% avg</span>}/>
            <div style={{padding:"12px 18px 18px",display:"flex",flexDirection:"column",gap:12}}>
              <BarSplit a={Math.max(0,totalDocs-aiDocs)} b={aiDocs} aLabel="Fallback" bLabel="Claude"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                <KV label="Total" value={totalDocs.toLocaleString()}/>
                <KV label="AI classified" value={aiDocs.toLocaleString()}/>
                <KV label="Avg confidence" value={`${Math.round(avgConf*100)}%`}/>
              </div>
            </div>
          </Card>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:12}}>
          <Card padding={0}><CardHeader title="Category breakdown"/>
            <div style={{padding:"12px 18px 18px",display:"flex",flexDirection:"column",gap:8}}>
              {cats.slice(0,8).map(c=><CatBar key={c.name} cat={c} max={Math.max(...cats.map(x=>x.count),1)} onClick={()=>router.push(`/documents?category=${encodeURIComponent(c.name)}`)}/>)}
              {!cats.length&&<div style={{fontSize:12,color:"var(--fg-muted)",padding:"8px 0"}}>No documents yet.</div>}
            </div>
          </Card>
          <Card padding={0}><CardHeader title="Recently indexed" hint={<span onClick={()=>router.push("/documents")} style={{fontSize:12,cursor:"pointer"}}>View all →</span>}/>
            <div style={{padding:6}}>
              {!recentDocs.length
                ?<div style={{padding:24,textAlign:"center"}}><Image src="/glyph.svg" width={36} height={36} alt="" style={{opacity:.25,margin:"0 auto 10px"}}/><div style={{fontSize:13,color:"var(--fg-muted)"}}>No documents yet.</div></div>
                :recentDocs.map(d=><RecentDocRow key={d.id} doc={d}/>)
              }
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({icon,label,value,sub,intent}:{icon:React.ReactNode;label:string;value:string;sub?:string;intent?:string}) {
  return <Card padding={16}>
    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"var(--fg-tertiary)",letterSpacing:"0.04em",textTransform:"uppercase"}}>
      <span style={{color:intent==="warning"?"var(--warning)":"var(--fg-muted)"}}>{icon}</span>{label}
    </div>
    <div style={{fontSize:28,fontWeight:600,letterSpacing:"-0.02em",marginTop:8,fontVariantNumeric:"tabular-nums",color:"var(--fg-primary)"}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"var(--fg-tertiary)",marginTop:6}}>{sub}</div>}
  </Card>;
}

function InsightRow({alert}:{alert:{severity:string;message:string;details:string}}) {
  const map:Record<string,{bg:string;fg:string;bd:string;icon:React.ReactNode}> = {
    warning:{bg:"var(--warning-bg)",fg:"var(--warning)",bd:"oklch(0.80 0.15 78/0.4)",icon:<AlertTriangle size={14}/>},
    danger:{bg:"var(--danger-bg)",fg:"var(--danger)",bd:"oklch(0.68 0.20 25/0.4)",icon:<AlertCircle size={14}/>},
  };
  const t = map[alert.severity]||{bg:"var(--info-bg)",fg:"var(--info)",bd:"oklch(0.72 0.13 220/0.4)",icon:<Info size={14}/>};
  return <div style={{display:"flex",gap:12,padding:"10px 12px",borderRadius:"var(--radius-md)",background:t.bg,border:`1px solid ${t.bd}`}}>
    <div style={{width:26,height:26,borderRadius:"var(--radius-md)",display:"grid",placeItems:"center",color:t.fg,flexShrink:0}}>{t.icon}</div>
    <div><div style={{fontSize:13,fontWeight:500,color:"var(--fg-primary)"}}>{alert.message}</div><div style={{fontSize:12,color:"var(--fg-tertiary)",marginTop:2}}>{alert.details}</div></div>
  </div>;
}

function BarSplit({a,b,aLabel,bLabel}:{a:number;b:number;aLabel:string;bLabel:string}) {
  const total=a+b||1; const aPct=a/total*100;
  return <div>
    <div style={{display:"flex",height:8,borderRadius:999,overflow:"hidden",background:"var(--ink-3)"}}>
      <div style={{width:aPct+"%",background:"var(--ink-7)"}}/><div style={{width:(100-aPct)+"%",background:"var(--accent-500)"}}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:"var(--fg-tertiary)"}}>
      <span><span style={{display:"inline-block",width:7,height:7,borderRadius:999,background:"var(--ink-7)",marginRight:6}}/>{aLabel}</span>
      <span><span style={{display:"inline-block",width:7,height:7,borderRadius:999,background:"var(--accent-500)",marginRight:6}}/>{bLabel}</span>
    </div>
  </div>;
}

function KV({label,value}:{label:string;value:string}) {
  return <div><div style={{fontSize:10,color:"var(--fg-muted)",letterSpacing:"0.04em",textTransform:"uppercase"}}>{label}</div><div style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--fg-primary)",marginTop:2,fontVariantNumeric:"tabular-nums"}}>{value}</div></div>;
}

function CatBar({cat,max,onClick}:{cat:{name:string;count:number};max:number;onClick:()=>void}) {
  const c=categoryColor(cat.name); const [hover,setHover]=useState(false);
  return <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
    style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",opacity:hover?1:0.92}}>
    <div style={{width:90,fontSize:12,color:"var(--fg-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</div>
    <div style={{flex:1,height:6,borderRadius:999,background:"var(--ink-3)",overflow:"hidden"}}>
      <div style={{width:(cat.count/max*100)+"%",height:"100%",background:c.fg,borderRadius:999,transition:"width 320ms"}}/>
    </div>
    <div style={{width:40,textAlign:"right",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--fg-tertiary)",fontVariantNumeric:"tabular-nums"}}>{cat.count}</div>
  </div>;
}

function RecentDocRow({doc}:{doc:any}) {
  const [hover,setHover]=useState(false);
  return <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
    style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:"var(--radius-md)",background:hover?"var(--bg-hover)":"transparent",cursor:"pointer"}}>
    <FileTypeIcon mime={doc.mime_type} size={28}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,color:"var(--fg-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.title}</div>
      <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--fg-muted)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.file_path}</div>
    </div>
    {doc.category&&<CategoryBadge name={doc.category} size="sm"/>}
    <div style={{fontSize:11,color:"var(--fg-muted)",width:80,textAlign:"right",flexShrink:0}}>{doc.indexed_at?formatDate(doc.indexed_at):""}</div>
  </div>;
}
