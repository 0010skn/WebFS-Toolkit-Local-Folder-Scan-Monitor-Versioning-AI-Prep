"use client";

import { ReactNode } from "react";
import { useViewport } from "@/lib/useViewport";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  // 在设置页的layout中也调用useViewport
  useViewport();

  return <>{children}</>;
}
