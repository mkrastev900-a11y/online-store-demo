"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "./AuthForm.module.css";
export default function ForgotPasswordForm(){
 const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setMessage("");setLoading(true);try{const fd=new FormData(e.currentTarget);const r=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:fd.get("email")})});const d=await r.json();if(!r.ok)setError(d.error??"Заявката не беше завършена.");else if (d.delivery === "failed") {
      setError(d.message);
    } else {
      setMessage(d.message);
    }}catch{setError("Няма връзка със сървъра.");}finally{setLoading(false)}}
 return <main className={styles.page}><section className={styles.card}><span className={styles.eyebrow}>СИГУРНОСТ</span><h1 className={styles.title}>Забравена парола</h1><p className={styles.subtitle}>Въведи имейла на профила си. Ще получиш еднократен линк, валиден 60 минути.</p><form className={styles.form} onSubmit={submit}><div className={styles.field}><label>Имейл</label><input name="email" type="email" autoComplete="email" required/></div>{error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}<button className={styles.button} disabled={loading}>{loading?"Изпращане...":"Изпрати линк"}</button></form><p className={styles.switch}><Link href="/login">Назад към вход</Link></p></section></main>;
}
