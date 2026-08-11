"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateOrderButton({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function createOrder() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/orders", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Поръчката не беше създадена.");
      setLoading(false);
      return;
    }

    setMessage("Поръчката е създадена и чака потвърждение.");
    router.refresh();
    setLoading(false);
  }

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={loading}
        onClick={createOrder}
      >
        {loading ? "Създаване..." : "Завърши поръчката"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
