"use client";

import { useEffect } from "react";
import { trackMarketingEvent } from "@/components/MarketingPixelManager";
import type { MarketingEventKey } from "@/lib/marketing-integrations";

export default function MarketingEventOnMount({ event, payload }: { event: MarketingEventKey; payload?: Record<string, unknown> }) {
  useEffect(() => {
    trackMarketingEvent({ event, ...(payload || {}) });
  }, [event, payload]);

  return null;
}
