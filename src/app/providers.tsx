"use client";

import { Provider as JotaiProvider } from "jotai";
import { ReactNode, useEffect } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";
import { useViewport } from "@/lib/useViewport";
import { setupGlobalViewport } from "@/lib/viewportScript";

export function Providers({ children }: { children: ReactNode }) {
  // 直接在Providers组件中调用useViewport hook
  useViewport();

  // 初始化全局viewport脚本
  useEffect(() => {
    setupGlobalViewport();
  }, []);

  return (
    <JotaiProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </JotaiProvider>
  );
}
