"use client";

import { Provider as JotaiProvider } from "jotai";
import { ReactNode, useEffect } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";
import { useViewport } from "@/lib/useViewport";
import { setupGlobalViewport } from "@/lib/viewportScript";
import { registerServiceWorker, captureInstallPrompt } from "@/lib/pwaUtils";

export function Providers({ children }: { children: ReactNode }) {
  // 直接在Providers组件中调用useViewport hook
  useViewport();

  // 初始化全局viewport脚本
  useEffect(() => {
    setupGlobalViewport();
  }, []);

  // 注册Service Worker
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 注册Service Worker
      registerServiceWorker().then((registered) => {
        if (registered) {
          console.log("Service Worker已注册");
        }
      });

      // 捕获PWA安装提示
      captureInstallPrompt();
    }
  }, []);

  return (
    <JotaiProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </JotaiProvider>
  );
}
