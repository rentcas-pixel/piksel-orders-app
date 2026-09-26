'use client';
import { useCallback, useEffect, useState } from 'react';
type Brief = {
  client?: string;
  agency?: string;
  city?: string;
  from?: string;
  to?: string;
  budget: number;
  duration: number;
  assumptions: string[];
};


type Job = { id: string; subject: string; status: string; token: string; error: string | null; reply: string | null; reviewed_at: string | null; source?: { body_text: string | null; from_address: string | null; folder?: string }; result?: {parentId?:string;pendingChange?:{id:string;instruction:string};historySources?:{orders:{id:string;client:string;agency:string;from:string;to:string;price:number;href:string}[]}; discussion?: {role:'user'|'assistant';text:string}[]; brief?: Brief; questions?: string[]; pikselShare?: number; assumptions: string[]; rationale?: { name: string; owner: string; reason: string }[]; record?: { campaign: { final_price: number } } } };
const labels: Record<string, string> = { queued: 'Laukia paruošimo', processing: 'Ruošiamas planas', ready: 'Planas paruoštas', needs_review: 'Reikia patikslinimo', failed: 'Nepavyko paruošti' };
const endpoint = '/api/email/inbox';
export function PlayInboxBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => { let active = true; const load = async () => { try { const r = await fetch(endpoint); if (!r.ok) return; const d = await r.json(); if (active) setCount(d.jobs.filter((j: Job) => j.status === 'ready' && !j.reviewed_at).length); } catch {} }; void load(); const timer = setInterval(load, 60000); return () => { active = false; clearInterval(timer); }; }, []);
  return count ? <span aria-label={`${count} paruošti planai`} className="ml-auto rounded-full bg-emerald-100 px-2 text-xs text-emerald-800">{count}</span> : null;
}
export function PlayInbox() {
  const [jobs,setJobs]=useState<Job[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('chat');if(id && /^[a-f0-9-]{36}$/i.test(id)) setSelected(id);},[]);
  useEffect(()=>{const url=new URL(window.location.href);if(selected) url.searchParams.set('chat',selected);else url.searchParams.delete('chat');window.history.replaceState(null,'',url);},[selected]);
  const [draftId,setDraftId]=useState('');
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    const response=await fetch(selected?`${endpoint}?current=${encodeURIComponent(selected)}`:endpoint);const data=await response.json();
    if(!response.ok) throw new Error(data.error || 'Nepavyko įkelti pokalbių.');
    setJobs(data.jobs);
  },[selected]);
  useEffect(()=>{void load().catch(e=>setError(e.message));const timer=setInterval(()=>void load().catch(()=>{}),15000);return()=>clearInterval(timer);},[load]);
  const job=jobs.find(j=>j.id===selected);
  const send=async(apply=false)=>{
    const id=selected || draftId || crypto.randomUUID();
    if(!selected) setDraftId(id);
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:apply?'applyChange':'chat',id,text:apply?'Pritaikyti pasiūlytą pakeitimą':text})});
      const data=await response.json();if(!response.ok) throw new Error(data.error);
      setSelected(data.id || id);setText('');setDraftId('');await load();
    }catch(e){setError(e instanceof Error?e.message:'Nepavyko. Žinutė išliko, galite pakartoti.');}finally{setBusy(false);}
  };
  const handleHistoryPlan=async(orderId:string)=>{
    if(!job) return;
    setBusy(true);setError('');
    try {
      const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'fromHistory',parentId:job.id,id:crypto.randomUUID(),orderId})});
      const d=await r.json();if(!r.ok) throw new Error(d.error);setSelected(d.id);await load();
    }catch(e){setError(e instanceof Error?e.message:'Nepavyko paruošti.');}finally{setBusy(false);}
  };
  const brief=job?.result?.brief;
  return <main className="mx-auto w-full max-w-[1600px] space-y-4 p-5">
    <header><h1 className="text-2xl font-semibold">Planavimo asistentas</h1><p className="text-sm text-gray-500">Užklausa, diskusija ir plano versijos viename pokalbyje</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="text-emerald-700">{notice}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)_350px]">
      <aside className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800"><button disabled={busy} onClick={()=>{setSelected(null);setDraftId('');setText('');setError('');}} className="m-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">Naujas pokalbis</button><div className="max-h-[70vh] overflow-auto">{jobs.map(j=><button disabled={busy} key={j.id} onClick={()=>{setSelected(j.id);setText('');}} className={`block w-full border-t p-3 text-left ${selected===j.id?'bg-emerald-50 text-gray-900':''}`}><strong className="line-clamp-2 text-sm">{j.subject}</strong><span className="mt-1 block text-xs text-gray-500">{labels[j.status]}</span></button>)}</div></aside>
      <section className="flex min-h-[650px] flex-col rounded-xl border bg-white dark:bg-gray-800">
        <div className="flex-1 space-y-4 p-5">
          {!job && <div className="py-10"><h2 className="text-xl font-semibold">Kokį planą ruošiame?</h2><p className="mt-3 text-gray-500">Įklijuok kliento laišką arba aprašyk kampaniją. Gali nurodyti klientą, agentūrą, miestus, savaitę ir orientacinį biudžetą.</p></div>}
          {job && !job.result?.discussion?.length && <div className="rounded-lg bg-gray-50 p-4 text-sm whitespace-pre-wrap dark:bg-gray-700">{job.source?.body_text || job.subject}</div>}
          <div aria-live="polite" className="space-y-4">{job?.result?.discussion?.map((message,i)=><article key={i} className={`rounded-xl p-4 ${message.role==='user'?'ml-8 bg-gray-100 dark:bg-gray-700':'mr-8 bg-emerald-50 text-gray-900'}`}><strong className="mb-2 block text-xs">{message.role==='user'?'Tu':'Planavimo asistentas'}</strong><p className="whitespace-pre-wrap text-sm">{message.text}</p></article>)}</div>
          {job?.result?.questions?.length ? <div className="rounded-lg border p-3 text-sm">{job.result.questions.map(q=><p key={q}>{q}</p>)}</div>:null}
          {job?.error && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{job.error}</p>}
          {job?.result?.pendingChange && <div className="rounded-lg border border-emerald-200 p-4"><p className="text-sm">{job.result.pendingChange.instruction}</p><button disabled={busy} onClick={()=>void send(true)} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-40">Pritaikyti pakeitimą</button></div>}
          {job?.result?.historySources?.orders?.map(order=><div key={order.id} className="rounded-lg border p-3 text-sm"><a href={order.href} target="_blank" rel="noreferrer"><strong>{order.client} · {order.agency}</strong><p>{order.from.slice(0,10)}–{order.to.slice(0,10)} · {order.price.toLocaleString('lt-LT')} € be PVM</p><p className="text-gray-500">Užsakymas {order.id} ↗</p></a><button disabled={busy} onClick={()=>void handleHistoryPlan(order.id)} className="mt-2 rounded border px-3 py-1">Naudoti kaip pagrindą</button></div>)}
        </div>
        <form onSubmit={e=>{e.preventDefault();void send();}} className="sticky bottom-0 rounded-b-xl border-t bg-white p-4 dark:bg-gray-800"><textarea aria-label="Žinutė planavimo asistentui" value={text} onChange={e=>setText(e.target.value)} maxLength={18000} className="h-28 w-full resize-y rounded-lg border bg-transparent p-3" placeholder={job?.result?.record?'Paklausk kodėl, pasiūlyk alternatyvą arba aprašyk pakeitimą…':'Pvz., Maxima, Media House, Vilnius, 49 savaitė, apie 5k…'}/><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-gray-500">Klausimas plano nekeičia. Pakeitimus pritaikysi atskirai.</p><button disabled={busy || !text.trim() || job?.status==='processing'} className="rounded-md bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">{busy?'Ruošiama…':'Siųsti'}</button></div></form>
      </section>
      <aside className="space-y-4 rounded-xl border bg-white p-5 dark:bg-gray-800"><h2 className="font-semibold">Dabartinis planas</h2>{brief?<><dl className="space-y-3 text-sm"><div><dt className="text-gray-500">Klientas / agentūra</dt><dd>{brief.client || 'Dar nenurodytas'}{brief.agency?` · ${brief.agency}`:''}</dd></div><div><dt className="text-gray-500">Miestai</dt><dd>{brief.city || 'Dar nenurodyti'}</dd></div><div><dt className="text-gray-500">Laikotarpis</dt><dd>{brief.from || '?'}–{brief.to || '?'}</dd></div><div><dt className="text-gray-500">Orientacinis BU be PVM</dt><dd>{brief.budget.toLocaleString('lt-LT')} €</dd></div><div><dt className="text-gray-500">Klipas</dt><dd>{brief.duration} sek.</dd></div></dl>{brief.assumptions.map((a,i)=><p key={i} className="text-xs text-gray-500">{a}</p>)}</>:<p className="text-sm text-gray-500">Sutarti duomenys atsiras čia.</p>}
      {job?.result?.record && <><p className="text-2xl font-semibold">{job.result.record.campaign.final_price.toLocaleString('lt-LT',{minimumFractionDigits:2,maximumFractionDigits:2})} € <span className="text-sm font-normal">be PVM</span></p><a href={`/skaiciuokle/index.html?campaign=${encodeURIComponent(job.token)}&from=hub#calculator`} target="_blank" rel="noreferrer" className="block rounded-md bg-gray-900 p-2 text-center text-sm text-white">Atidaryti mano planą ↗</a><a href={`/${encodeURIComponent(job.token)}`} target="_blank" rel="noreferrer" className="block rounded-md border p-2 text-center text-sm">Kliento nuoroda ↗</a><p className="text-xs text-gray-500">Kaina atnaujinama iš išsaugoto plano.</p>{job.result.rationale?.map(s=><div key={s.name} className="text-sm"><strong>{s.name} · {s.owner}</strong><p className="text-xs text-gray-500">{s.reason}</p></div>)}{job.result.assumptions?.map((a,i)=><p key={i} className="rounded bg-amber-50 p-2 text-xs text-amber-900">{a}</p>)}</>}
      {job?.result?.parentId && <button onClick={()=>setSelected(job.result!.parentId!)} className="text-sm text-blue-600">← Ankstesnė versija</button>}
      {job?.reply && <details><summary className="cursor-pointer text-sm font-medium">Laiško juodraštis</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{job.reply}</pre><button onClick={()=>void navigator.clipboard.writeText(job.reply || '').then(()=>setNotice('Juodraštis nukopijuotas.')).catch(()=>setError('Nepavyko nukopijuoti.'))} className="mt-3 rounded border px-3 py-2 text-sm">Kopijuoti</button><p className="mt-2 text-xs text-gray-500">Laiškas automatiškai nesiunčiamas.</p></details>}
      </aside>
    </div>
  </main>;
}
