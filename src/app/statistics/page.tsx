"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StatisticsContent from "@/components/StatisticsContent";
import { useTranslations } from "@/components/LocaleProvider";

export default function StatisticsPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [mounted, setMounted] = useState(false);

  // 确保组件在客户端挂载后才渲染，避免水合错误
  useEffect(() => {
    setMounted(true);
  }, []);

  // 如果组件未挂载，返回null
  if (!mounted) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <svg
            className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {t("statistics.title")}
        </h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors duration-300 flex items-center"
        >
          <svg
            className="h-4 w-4 mr-1"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          {t("settings.back")}
        </button>
      </div>

      <StatisticsContent />
    </div>
  );
}
