"use client";

import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  dockerfilesAtom,
  knowledgeModalOpenAtom,
} from "../lib/store";
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
import KnowledgeModal from "../components/KnowledgeModal";
import MultiThreadScanAlert from "../components/MultiThreadScanAlert";
import IncrementalScanAlert from "../components/IncrementalScanAlert";
import RssFeed from "../components/RssFeed";
import GitHubDownloader from "../components/GitHubDownloader";

export default function Home() {
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [dockerfiles] = useAtom(dockerfilesAtom);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useAtom(
    knowledgeModalOpenAtom
  );
  const { t } = useTranslations();
  const router = useTransitionRouter();
  const [mounted, setMounted] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  // Docker页面跳转
  const handleGoToDocker = () => {
    router.push("/docker", {
      onTransitionReady: slideInOut,
    });
  };

  // Docker Compose页面跳转
  const handleGoToDockerCompose = () => {
    router.push("/docker?tab=compose", {
      onTransitionReady: slideInOut,
    });
  };

  // 环境变量页面跳转
  const handleGoToEnvFile = () => {
    router.push("/docker?tab=env", {
      onTransitionReady: slideInOut,
    });
  };

  // 更新日志页面跳转
  const handleGoToChangelog = () => {
    router.push("/changelog", {
      onTransitionReady: slideInOut,
    });
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      {/* 浏览器兼容性检查组件 */}
      <BrowserCompatCheck />

      {/* 顶部导航栏 - 类似VSCode和GitHub的风格 */}
      <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 transition-colors duration-300 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            {/* 左侧标题和Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-blue-600 dark:text-blue-500"
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
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <SettingsButton />

              {directoryHandle && (
                <>
                  {/* 在小屏幕上使用下拉菜单 */}
                  <div className="sm:hidden relative">
                    <button
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                      aria-label="Menu"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </button>

                    {/* 移动端下拉菜单 */}
                    {showMobileMenu && (
                      <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                          <button
                            onClick={handleGoToStatistics}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("nav.statistics")}
                          </button>

                          {dockerfiles.exists && (
                            <>
                              <button
                                onClick={handleGoToDocker}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                {t("docker.title")}
                              </button>

                              <button
                                onClick={handleGoToDockerCompose}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                {t("dockerCompose.title")}
                              </button>
                            </>
                          )}

                          <button
                            onClick={handleGoToEnvFile}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("envFile.title")}
                          </button>

                          <button
                            onClick={() => setShowVersionModal(true)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("versionManager.title")}
                          </button>

                          {/* 知识库按钮 */}
                          <button
                            onClick={() => setKnowledgeModalOpen(true)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("knowledgeModal.title")}
                          </button>

                          {/* 更新日志按钮 */}
                          <button
                            onClick={handleGoToChangelog}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("changelog.title")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 在大屏幕上显示常规按钮 */}
                  <div className="hidden sm:flex sm:items-center sm:space-x-4">
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

                    {/* Docker标签，仅当检测到Docker文件时显示 */}
                    {dockerfiles.exists && (
                      <>
                        <button
                          onClick={handleGoToDocker}
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
                              d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                            />
                          </svg>
                          {t("docker.title")}
                        </button>

                        {/* Docker Compose按钮 */}
                        <button
                          onClick={handleGoToDockerCompose}
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
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                          {t("dockerCompose.title")}
                        </button>
                      </>
                    )}

                    {/* 环境变量按钮 */}
                    <button
                      onClick={handleGoToEnvFile}
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
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      {t("envFile.title")}
                    </button>

                    <button
                      onClick={() => setShowVersionModal(true)}
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
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("versionManager.title")}
                    </button>

                    {/* 知识库按钮 */}
                    <button
                      onClick={() => setKnowledgeModalOpen(true)}
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {t("knowledgeModal.title")}
                    </button>

                    {/* 更新日志按钮 */}
                    <button
                      onClick={handleGoToChangelog}
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
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      {t("changelog.title")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!directoryHandle ? (
          <motion.div
            key="folder-picker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center p-4"
          >
            <div className="max-w-3xl w-full mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-colors duration-300 border border-gray-200 dark:border-gray-700">
                <div className="p-8">
                  <div className="text-center mb-8">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="inline-block p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full mb-6"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-blue-600 dark:text-blue-400"
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
                    </motion.div>
                    <motion.h2
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
                    >
                      {t("folderPicker.welcomeTitle")}
                    </motion.h2>
                    <motion.p
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="text-gray-600 dark:text-gray-300"
                    >
                      {t("folderPicker.welcomeDescription")}
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="space-y-6">
                      {/* 文件夹选择器 */}
                      <FolderPicker />

                      {/* GitHub仓库下载功能 */}
                      <GitHubDownloader />

                      {/* 快速启动区域 - 类似VSCode的欢迎页 */}
                      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2 text-blue-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          {t("homePage.quickStart")}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={() => setKnowledgeModalOpen(true)}
                            className="flex items-center text-left p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                          >
                            <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-md flex items-center justify-center mr-3">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-purple-600 dark:text-purple-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                />
                              </svg>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {t("homePage.openKnowledgeBase")}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t("homePage.manageKnowledge")}
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={handleGoToChangelog}
                            className="flex items-center text-left p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                          >
                            <div className="w-8 h-8 bg-green-50 dark:bg-green-900/30 rounded-md flex items-center justify-center mr-3">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-green-600 dark:text-green-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                              </svg>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {t("homePage.viewChangelog")}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t("homePage.learnUpdates")}
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Linux.do RSS Feed */}
                      <RssFeed />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400"
                  >
                    <p className="flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("folderPicker.privacyNote")}
                    </p>
                  </motion.div>
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
              {/* 多线程扫描支持检测提示 */}
              <MultiThreadScanAlert />

              {/* 增量扫描支持提示 */}
              <IncrementalScanAlert />

              {/* GitHub仓库下载功能 */}
              <GitHubDownloader />

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-300 border border-gray-200 dark:border-gray-700">
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

      {/* 引入知识库模态窗口组件 */}
      <KnowledgeModal />
    </div>
  );
}
