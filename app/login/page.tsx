import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { findPublicUserById } from "@/lib/auth-db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (session) {
    const user = await findPublicUserById(session.userId);
    if (user) {
      redirect(user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/" : "/account");
    }
  }
  return <Suspense><LoginForm /></Suspense>;
}
