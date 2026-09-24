import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/currency";
import Seo from "../components/Seo";
import Button from "../components/Button";

type EftPayment = {
  id: string; business_id: string; subscription_id: string; amount: number; reference: string;
  status: "pending" | "confirmed" | "rejected"; note: string | null; created_at: string; reviewed_at: string | null;
  business?: { company_name: string | null; full_name: string | null; phone: string | null } | null;
};

export default function AdminActivationPayments() {
  const [payments,setPayments]=useState<EftPayment[]>([]);
  const [loading,setLoading]=useState(true);
  const [actionId,setActionId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function load(){
    setLoading(true); setError(null);
    const {data,error:loadError}=await supabase.from("business_activation_eft_payments")
      .select("*, business:profiles(company_name, full_name, phone)").order("created_at",{ascending:false});
    if(loadError)setError(loadError.message); else setPayments((data??[]) as EftPayment[]);
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  async function review(id:string,action:"confirm"|"reject"){
    setActionId(id); setError(null);
    const {error:rpcError}=await supabase.rpc(action==="confirm"?"confirm_business_activation_eft":"reject_business_activation_eft",{p_payment_id:id});
    setActionId(null);
    if(rpcError){setError(rpcError.message);return;}
    await load();
  }

  const pending=payments.filter(p=>p.status==="pending");
  return <div className="max-w-6xl mx-auto px-5 py-10">
    <Seo title="Admin · Activation EFT Payments" noindex />
    <div className="mb-8">
      <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Financials & Risk</p>
      <h1 className="font-display text-2xl md:text-3xl">Business Activation EFT</h1>
      <p className="text-sm text-billboard-inkSoft mt-2">Manual EFT declarations stay pending until you verify the money has landed in ChatSched's bank account.</p>
    </div>
    {error&&<div className="border-2 border-billboard-red text-billboard-red rounded p-3 mb-5 text-sm font-semibold">{error}</div>}
    <div className="grid sm:grid-cols-3 gap-3 mb-8">
      <div className="border-2 border-billboard-ink rounded p-4"><p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Pending</p><p className="text-2xl font-bold">{pending.length}</p></div>
      <div className="border-2 border-billboard-ink rounded p-4"><p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Confirmed</p><p className="text-2xl font-bold">{payments.filter(p=>p.status==="confirmed").length}</p></div>
      <div className="border-2 border-billboard-ink rounded p-4"><p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Pending value</p><p className="text-2xl font-bold">{formatCurrency(pending.reduce((s,p)=>s+Number(p.amount),0))}</p></div>
    </div>
    {loading?<div className="border-[3px] border-billboard-ink rounded p-8 text-sm">Loading activation EFT payments…</div>:
     payments.length===0?<div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-sm text-billboard-inkSoft">No manual EFT declarations yet.</div>:
     <div className="space-y-4">{payments.map(p=>{
       const businessName=p.business?.company_name||p.business?.full_name||p.business_id;
       return <div key={p.id} className="border-[3px] border-billboard-ink rounded-lg p-5">
         <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
           <div><p className="font-bold">{businessName}</p><p className="text-xs text-billboard-inkSoft mt-1">{p.business?.phone||"No phone"} · {new Date(p.created_at).toLocaleString("en-ZA")}</p>
             <p className="font-mono text-xs mt-3">Reference: <strong>{p.reference}</strong></p>
             <p className="font-mono text-xs mt-1">Amount: <strong>{formatCurrency(Number(p.amount))}</strong></p>
             {p.note&&<p className="text-sm text-billboard-inkSoft mt-3 whitespace-pre-wrap">{p.note}</p>}
           </div>
           <span className="font-mono text-[10px] uppercase border-2 rounded px-2 py-1">{p.status}</span>
         </div>
         {p.status==="pending"&&<div className="mt-5 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap gap-2">
           <Button variant="primary" size="md" disabled={actionId===p.id} onClick={()=>review(p.id,"confirm")}>{actionId===p.id?"Processing…":"Confirm EFT & Activate"}</Button>
           <Button variant="outline" size="md" disabled={actionId===p.id} onClick={()=>review(p.id,"reject")}>Reject</Button>
         </div>}
       </div>;
     })}</div>}
  </div>;
}
