"use client";

import { useEffect, useState } from "react";
import { Tab } from "@headlessui/react";
import { useTranslations } from "@/components/LocaleProvider";
import { useTransitionRouter } from "next-view-transitions";
import { slideInOut } from "../../lib/publicCutscene";
import DockerView from "@/components/DockerView";
import DockerComposeView from "@/components/DockerComposeView";
import EnvFileView from "@/components/EnvFileView";
import { useSearchParams } from "next/navigation";

export default function DockerPage() {
  const { t } = useTranslations();
  const router = useTransitionRouter();
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 确保组件在客户端挂载后才渲染
  useEffect(() => {
    setMounted(true);

    // 根据URL参数设置选中的Tab
    if (tabParam === "env") {
      setSelectedIndex(2); // 环境变量是第三个Tab（索引为2）
    } else if (tabParam === "compose") {
      setSelectedIndex(1); // Docker Compose是第二个Tab（索引为1）
    }
  }, [tabParam]);

  // 返回主页
  const handleGoBack = () => {
    router.push("/", {
      onTransitionReady: slideInOut,
    });
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      {/* 顶部标题栏 */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 transition-colors duration-300 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <button
                onClick={handleGoBack}
                className="mr-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-1 rounded-md"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
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
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("docker.title")}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-colors duration-300 h-full">
          <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
            <Tab.List className="flex space-x-1 bg-blue-900/20 dark:bg-blue-900/10 p-1">
              <Tab
                className={({ selected }) =>
                  `w-full py-2.5 text-sm font-medium leading-5 text-gray-700 dark:text-gray-300
                   rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60
                   ${
                     selected
                       ? "bg-white dark:bg-gray-700 shadow text-blue-700 dark:text-blue-400"
                       : "hover:bg-white/[0.12] hover:text-blue-600 dark:hover:text-blue-300"
                   }`
                }
              >
                {t("docker.title")}
              </Tab>
              <Tab
                className={({ selected }) =>
                  `w-full py-2.5 text-sm font-medium leading-5 text-gray-700 dark:text-gray-300
                   rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60
                   ${
                     selected
                       ? "bg-white dark:bg-gray-700 shadow text-blue-700 dark:text-blue-400"
                       : "hover:bg-white/[0.12] hover:text-blue-600 dark:hover:text-blue-300"
                   }`
                }
              >
                {t("dockerCompose.title")}
              </Tab>
              <Tab
                className={({ selected }) =>
                  `w-full py-2.5 text-sm font-medium leading-5 text-gray-700 dark:text-gray-300
                   rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60
                   ${
                     selected
                       ? "bg-white dark:bg-gray-700 shadow text-blue-700 dark:text-blue-400"
                       : "hover:bg-white/[0.12] hover:text-blue-600 dark:hover:text-blue-300"
                   }`
                }
              >
                {t("envFile.title")}
              </Tab>
            </Tab.List>
            <Tab.Panels className="h-[calc(100%-48px)]">
              <Tab.Panel className="h-full">
                <DockerView />
              </Tab.Panel>
              <Tab.Panel className="h-full">
                <DockerComposeView />
              </Tab.Panel>
              <Tab.Panel className="h-full">
                <EnvFileView />
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>© 2024 Folda-Scan. All rights reserved.</p>
      </footer>
    </div>
  );
}
