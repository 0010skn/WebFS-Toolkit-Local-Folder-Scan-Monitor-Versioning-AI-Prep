"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import {
  FiGithub,
  FiDownload,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";

export default function GitHubDownloader() {
  const { t } = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);
  const [username, setUsername] = useState("");
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 处理展开/折叠
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    // 重置状态
    if (!isExpanded) {
      setError(null);
      setSuccess(false);
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    if (!username.trim()) {
      setError(t("github.invalidRepo"));
      return false;
    }
    if (!repository.trim()) {
      setError(t("github.invalidRepo"));
      return false;
    }
    return true;
  };

  // 下载仓库
  const downloadRepository = () => {
    if (!validateForm()) return;

    try {
      const downloadUrl = `https://api.github.com/repos/${username}/${repository}/zipball/${branch}`;
      // 打开新窗口进行下载
      window.open(downloadUrl, "_blank");
      // 显示成功消息
      setSuccess(true);

      // 清除表单
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("打开下载链接出错:", err);
      setError(t("github.networkError"));
    }
  };

  // 渲染标题栏
  const renderHeader = () => (
    <div
      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b-2 border-blue-500 dark:border-blue-600 rounded-t-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm"
      onClick={toggleExpand}
    >
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
        <FiGithub className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-500" />
        <span>{t("github.title")}</span>
      </h2>
      <div className="flex items-center">
        {isExpanded ? (
          <IoChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        ) : (
          <IoChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full mt-6">
      {renderHeader()}

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden bg-white dark:bg-gray-800 rounded-b-lg shadow-sm border border-t-0 border-gray-200 dark:border-gray-700"
          >
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t("github.description")}
              </p>

              <div className="space-y-4">
                {/* 用户名/组织名输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("github.username")}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("github.placeholder.username")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* 仓库名输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("github.repository")}
                  </label>
                  <input
                    type="text"
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder={t("github.placeholder.repository")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* 分支名输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("github.branch")}
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {t("github.defaultBranch")}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder={t("github.placeholder.branch")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* 下载按钮 */}
                <div className="flex justify-end">
                  <button
                    onClick={downloadRepository}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
                  >
                    <FiDownload className="mr-2" />
                    {t("github.download")}
                  </button>
                </div>

                {/* 错误信息 */}
                {error && (
                  <div className="mt-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-600 p-4 rounded">
                    <div className="flex">
                      <FiAlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
                      <span className="text-red-700 dark:text-red-400">
                        {error}
                      </span>
                    </div>
                  </div>
                )}

                {/* 成功信息 */}
                {success && (
                  <div className="mt-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-600 p-4 rounded">
                    <div className="flex">
                      <FiCheckCircle className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
                      <span className="text-green-700 dark:text-green-400">
                        {t("github.success")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
