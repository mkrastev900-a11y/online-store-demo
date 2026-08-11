"use client";

import { useState } from "react";
import styles from "./UsersAdminPanel.module.css";

type UserRow = {
  id:number; name:string; email:string; phone:string|null; address:string|null; addressLine2:string|null;
  city:string|null; postalCode:string|null; country:string|null; role:string; isActive:boolean;
  authProvider:string; emailVerifiedAt:string|null; termsAcceptedAt:string|null; termsVersion:string|null;
  createdAt:string; lastLoginAt:string|null; _count:{orders:number;favorites:number};
  verificationCode:{id:number;codePlain:string|null;expiresAt:string;attempts:number;createdAt:string;expired:boolean}|null;
};

function date(value:string|null){ return value ? new Date(value).toLocaleString("bg-BG") : "—"; }

export default function UsersAdminPanel({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users,setUsers]=useState(initialUsers); const [busy,setBusy]=useState<number|null>(null); const [message,setMessage]=useState("");
  async function verify(id:number){
    setBusy(id); setMessage("");
    try{
      const response=await fetch(`/api/admin/users/${id}/verify`,{method:"POST"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Потвърждението не бе успешно.");
      setUsers(current=>current.map(user=>user.id===id?{...user,emailVerifiedAt:data.emailVerifiedAt,verificationCode:null}:user));
      setMessage("Акаунтът е потвърден ръчно.");
    }catch(error){setMessage(error instanceof Error?error.message:"Възникна грешка.");}finally{setBusy(null);}
  }
  return <section className={styles.list}>
    {message?<div className={styles.message}>{message}</div>:null}
    {users.map(user=>{
      const pending=user.authProvider==="credentials"&&!user.emailVerifiedAt;
      const pendingTerms=!user.termsAcceptedAt;
      const code=user.verificationCode;
      const expired=code?.expired ?? false;
      return <article className={`${styles.card} ${pending?styles.pending:""}`} key={user.id}>
        <header><div className={styles.avatar}>{user.name.slice(0,1).toUpperCase()}</div><div><h2>{user.name}</h2><p>{user.email}</p></div><span className={(pending||pendingTerms)?styles.waiting:styles.verified}>{pending?"Чака имейл код":pendingTerms?"Чака Общи условия":"Активен"}</span></header>
        <div className={styles.grid}>
          <div><b>Телефон</b><span>{user.phone||"—"}</span></div><div><b>Доставъчен адрес</b><span>{[user.address,user.addressLine2,user.postalCode,user.city,user.country].filter(Boolean).join(", ")||"—"}</span></div>
          <div><b>Регистрация</b><span>{date(user.createdAt)}</span></div><div><b>Последен вход</b><span>{date(user.lastLoginAt)}</span></div>
          <div><b>Метод за вход</b><span>{user.authProvider==="google"?"Google":"Имейл и парола"}</span></div><div><b>Роля / състояние</b><span>{user.role} · {!user.isActive?"Блокиран":pendingTerms?"Неактивиран до приемане":"Активен"}</span></div>
          <div><b>Общи условия</b><span>{user.termsAcceptedAt?`Приети ${date(user.termsAcceptedAt)} (${user.termsVersion||"без версия"})`:"Не са приети"}</span></div><div><b>Активност</b><span>{user._count.orders} поръчки · {user._count.favorites} любими</span></div>
        </div>
        {pending?<div className={styles.codeBox}>
          <div><small>АКТИВЕН 6-ЦИФРЕН КОД</small><strong>{code?.codePlain||"Няма наличен код"}</strong>{code?<span className={expired?styles.expired:""}>{expired?"Изтекъл":"Валиден до"}: {date(code.expiresAt)} · опити {code.attempts}/5</span>:null}</div>
          <button type="button" onClick={()=>verify(user.id)} disabled={busy===user.id}>{busy===user.id?"Потвърждаване...":"Потвърди акаунта ръчно"}</button>
        </div>:<div className={styles.confirmed}>Имейлът е потвърден: {date(user.emailVerifiedAt)}</div>}
      </article>;
    })}
    {!users.length?<div className={styles.empty}>Няма намерени потребители.</div>:null}
  </section>;
}
