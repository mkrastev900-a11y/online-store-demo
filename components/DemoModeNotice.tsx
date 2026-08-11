import { getDemoDataTtlMinutes, isDemoModeEnabled } from "@/lib/demo-mode";

import DemoModeNoticeClient from "./DemoModeNoticeClient";

export default function DemoModeNotice() {
  if (!isDemoModeEnabled()) return null;

  return <DemoModeNoticeClient ttlMinutes={getDemoDataTtlMinutes()} />;
}
