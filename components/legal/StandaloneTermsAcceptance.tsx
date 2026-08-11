"use client";
import { useRouter, useSearchParams } from "next/navigation";
import TermsAcceptanceModal from "./TermsAcceptanceModal";

function safeInternalPath(value: string | null) {
  if (!value?.startsWith("/") || /[\u0000-\u001f\u007f]/.test(value)) return "/login";
  try {
    const base = new URL("https://store.invalid");
    const resolved = new URL(value, base);
    return resolved.origin === base.origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : "/login";
  } catch {
    return "/login";
  }
}

export default function StandaloneTermsAcceptance(){const router=useRouter();const search=useSearchParams();const token=search.get("token")||"";const next=safeInternalPath(search.get("next"));if(!token)return <main style={{padding:"4rem",textAlign:"center"}}><h1>Невалиден линк</h1></main>;return <TermsAcceptanceModal token={token} onAccepted={()=>router.push(next)} />}
