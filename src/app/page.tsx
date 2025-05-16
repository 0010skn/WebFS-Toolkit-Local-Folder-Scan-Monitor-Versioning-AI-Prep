"use client";

import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { directoryHandleAtom } from "../lib/store";
import { useTranslations } from "@/components/LocaleProvider";
import { useTransitionRouter } from "next-view-transitions";
import { slideInOut } from "../lib/publicCutscene";
import { motion, AnimatePresence } from "framer-motion";
import FolderPicker from "../components/FolderPicker";
import ScanControls from "../components/ScanControls";
import ResultDisplay from "../components/ResultDisplay";
import ThemeToggle from "../components/ThemeToggle";
import VersionManager from "../components/VersionManager";
import SettingsButton from "../components/SettingsModal";
import BrowserCompatCheck from "../components/BrowserCompatCheck";

export default function Home() {
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const { t } = useTranslations();
  const router = useTransitionRouter();
  const [mounted, setMounted] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  // 确保组件在客户端挂载后才渲染，避免水合错误
  useEffect(() => {
    setMounted(true);
  }, []);

  // 跳转到统计页面
  const handleGoToStatistics = () => {
    router.push("/statistics", {
      onTransitionReady: slideInOut,
    });
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      {/* 浏览器兼容性检查组件 */}
      <BrowserCompatCheck />

      {/* Mac风格顶部导航栏 */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 transition-colors duration-300 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            {/* 左侧标题和Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <h1 className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
                Folda-Scan
              </h1>
            </div>

            {/* 右侧工具区 */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <SettingsButton />

              {directoryHandle && (
                <>
                  <button
                    onClick={handleGoToStatistics}
                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
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
                    {t("nav.statistics")}
                  </button>

                  <button
                    onClick={() => setShowVersionModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors dark:bg-purple-700 dark:hover:bg-purple-800"
                  >
                    {t("versionManager.title")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!directoryHandle ? (
          /* 全屏文件夹选择界面 */
          <motion.div
            key="folder-picker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-colors duration-300">
                <div className="p-8">
                  <div className="text-center mb-8">
                    <div className="inline-block p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full mb-4">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {t("folderPicker.welcomeTitle")}
                    </h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                      {t("folderPicker.welcomeDescription")}
                    </p>
                  </div>

                  <FolderPicker />

                  <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    <p>{t("folderPicker.privacyNote")}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* 主应用界面 */
          <motion.main
            key="main-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6"
          >
            <div className="space-y-6">
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-colors duration-300">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <FolderPicker />
                  </div>
                  <ScanControls />
                </div>
              </section>

              <ResultDisplay />
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      <footer className="mt-auto py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>{t("about.copyright")}</p>
      </footer>

      {directoryHandle && showVersionModal && (
        <div
          className="fixed inset-0 z-[9999]"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <VersionManager onClose={() => setShowVersionModal(false)} />
        </div>
      )}
    </div>
  );
}
