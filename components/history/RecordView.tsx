"use client";

import { useEffect } from "react";

export default function RecordView({
  productId,
}: {
  productId: number;
}) {
  useEffect(() => {
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
      keepalive: true,
    }).catch(() => {});
  }, [productId]);

  return null;
}
