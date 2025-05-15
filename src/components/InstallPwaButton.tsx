"use client";

import { useState, useEffect } from "react";
import {
  isPwaInstallable,
  isPwaInstalled,
  showInstallPrompt,
} from "@/lib/pwaUtils";
import { useTranslations } from "./LocaleProvider";

export default function InstallPwaButton() {
  const { t } = useTranslations();
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 只在客户端执行
    if (typeof window !== "undefined") {
      // 检查是否可安装
      setIsInstallable(isPwaInstallable());

      // 检查是否已安装
      setIsInstalled(isPwaInstalled());

      // 监听显示模式变化（当安装后会从browser变为standalone）
      const mediaQuery = window.matchMedia("(display-mode: standalone)");

      const handleChange = (e: MediaQueryListEvent) => {
        setIsInstalled(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }
  }, []);

  // 如果已安装或不可安装，则不显示按钮
  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    const installed = await showInstallPrompt();
    if (installed) {
      setIsInstalled(true);
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25"
        />
      </svg>
      {t("pwa.install") || "将网页安装为应用"}
    </button>
  );
}
