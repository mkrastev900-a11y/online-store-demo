"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "./TermsAcceptanceModal.module.css";

export default function TermsAcceptanceModal({token,onAccepted}:{token:string;onAccepted:()=>void}){
 const [accepted,setAccepted]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function confirm(){setBusy(true);setError("");try{const r=await fetch("/api/auth/accept-terms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,accepted})});const d=await r.json();if(!r.ok)return setError(d.error||"Приемането не беше записано.");onAccepted();}catch{setError("Няма връзка със сървъра.");}finally{setBusy(false)}}
 return <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="terms-title"><section className={styles.modal}>
  <span className={styles.icon}>✓</span><p className={styles.eyebrow}>ПОСЛЕДНА СТЪПКА</p><h2 id="terms-title">Приеми Общите условия</h2>
  <p>Имейлът е потвърден успешно. За да активираш профила, прочети и приеми правилата за поръчки, доставка, повредени пратки, 14-дневен отказ и рекламации.</p>
  <div className={styles.summary}><strong>Важно:</strong><span>Приемането не отменя законовите ти права като потребител.</span></div>
  <label className={styles.check}><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Прочетох и приемам <Link href="/terms" target="_blank">Общите условия</Link> и съм запознат/а с <Link href="/cookie-policy" target="_blank">политиката за бисквитки</Link>.</span></label>
  {error&&<div className={styles.error}>{error}</div>}<button disabled={!accepted||busy} onClick={confirm}>{busy?"Записване...":"Приемам и активирам профила"}</button>
 </section></div>
}
