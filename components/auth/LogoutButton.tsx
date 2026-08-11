"use client";
import { useRouter } from "next/navigation";
import { emitAuthUpdated } from "@/lib/auth-events";

export default function LogoutButton({className}:{className?:string}) {
  const router = useRouter();
  return <button className={className} onClick={async()=>{
    await fetch("/api/auth/logout",{method:"POST",credentials:"include"});
    emitAuthUpdated({ user: null });
    router.push("/");
    router.refresh();
  }}>Изход</button>;
}
