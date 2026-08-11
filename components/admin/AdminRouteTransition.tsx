"use client";

import { usePathname } from "next/navigation";

import styles from "@/app/admin/admin.module.css";

export default function AdminRouteTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={styles.routeScene}>
      {children}
    </div>
  );
}
