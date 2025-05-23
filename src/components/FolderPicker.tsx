"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  hasGitignoreAtom,
  scanStatusAtom,
  errorMessageAtom,
  gitignoreContentAtom,
  themeAtom,
} from "../lib/store";

// 确保window.directoryHandle存在
declare global {
  interface Window {
    directoryHandle: FileSystemDirectoryHandle | null;
  }
}
import {
  requestDirectoryAccess,
  checkGitignoreExists,
} from "../lib/scanService";
import { useTranslations } from "./LocaleProvider";
import { motion } from "framer-motion";

export default function FolderPicker() {
  const { t } = useTranslations();
  const [isSelecting, setIsSelecting] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useAtom(directoryHandleAtom);
  const [hasGitignore, setHasGitignore] = useAtom(hasGitignoreAtom);
  const [scanStatus, setScanStatus] = useAtom(scanStatusAtom);
  const [errorMessage, setErrorMessage] = useAtom(errorMessageAtom);
  const [gitignoreContent, setGitignoreContent] = useAtom(gitignoreContentAtom);
  const [theme] = useAtom(themeAtom);
  const [showGitignoreModal, setShowGitignoreModal] = useState(false);

  const handleSelectFolder = async () => {
    try {
      setIsSelecting(true);
      setScanStatus("idle");
      setErrorMessage(null);

      // 请求文件夹访问权限
      const dirHandle = await requestDirectoryAccess();

      if (!dirHandle) {
        setErrorMessage(t("folderPicker.noPermission"));
        return;
      }

      // 检查是否存在.gitignore文件并获取内容
      const gitignoreResult = await checkGitignoreExists(dirHandle);
      setHasGitignore(gitignoreResult.exists);
      setGitignoreContent(gitignoreResult.content);

      // 更新目录句柄
      setDirectoryHandle(dirHandle);

      // 将目录句柄保存到全局变量，供文件操作使用
      window.directoryHandle = dirHandle;
    } catch (error) {
      console.error("选择文件夹时出错:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "选择文件夹时出错"
      );
    } finally {
      setIsSelecting(false);
    }
  };

  // 打开查看gitignore规则弹窗
  const handleViewRules = () => {
    setShowGitignoreModal(true);
  };

  // 关闭查看gitignore规则弹窗
  const handleCloseModal = () => {
    setShowGitignoreModal(false);
  };

  // 渲染gitignore规则弹窗
  const renderGitignoreModal = () => {
    if (!showGitignoreModal) return null;

    // 解析gitignore内容为规则列表
    const rules = gitignoreContent
      ? gitignoreContent
          .split("\n")
          .filter((line) => line.trim() && !line.trim().startsWith("#"))
      : [];

    const comments = gitignoreContent
      ? gitignoreContent
          .split("\n")
          .filter((line) => line.trim().startsWith("#"))
          .map((line) => line.trim())
      : [];

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col transition-colors duration-300 shadow-2xl border border-gray-200 dark:border-gray-700"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium text-gray-900 dark:text-white flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-blue-500"
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
              {t("folderPicker.gitignoreRules")}
            </h3>
            <button
              onClick={handleCloseModal}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="flex-grow overflow-auto">
            {rules.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
                    {t("folderPicker.ignoreRules")}
                  </h4>
                  <ul className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg divide-y dark:divide-gray-600 font-mono text-sm">
                    {rules.map((rule, index) => (
                      <li key={index} className="py-2 flex items-start">
                        <span className="inline-block bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-1 rounded-md text-sm">
                          {rule}
                        </span>
                        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                          {rule.includes("*")
                            ? t("folderPicker.wildcardRule")
                            : rule.startsWith("!")
                            ? t("folderPicker.excludeRule")
                            : rule.endsWith("/")
                            ? t("folderPicker.directoryRule")
                            : t("folderPicker.fileRule")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {comments.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
                      {t("folderPicker.comments")}
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                      {comments.map((comment, index) => (
                        <p key={index} className="mb-1 font-mono">
                          {comment}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 text-center py-10">
                {gitignoreContent === ""
                  ? t("folderPicker.gitignoreEmpty")
                  : t("folderPicker.gitignoreUnreadable")}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t dark:border-gray-700 text-right">
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t("settings.close")}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  // 更新为VSCode/GitHub风格的文件夹选择按钮
  const renderFolderPickerButton = () => {
    return (
      <motion.button
        onClick={handleSelectFolder}
        disabled={isSelecting}
        whileHover={{
          scale: 1.01,
        }}
        whileTap={{ scale: 0.99 }}
        className={`
          w-full flex items-center justify-center px-6 py-3.5
          ${
            directoryHandle
              ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
              : "bg-blue-600 hover:bg-blue-700 text-white border border-blue-700"
          }
          rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:opacity-50 transition-all duration-200 shadow-sm
          font-medium text-base
        `}
      >
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 mr-2 ${
              directoryHandle
                ? "text-blue-600 dark:text-blue-400"
                : "text-white"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {directoryHandle ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            )}
          </svg>
          <span>
            {isSelecting ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {t("folderPicker.selecting")}
              </div>
            ) : directoryHandle ? (
              t("folderPicker.changeFolder")
            ) : (
              t("folderPicker.selectFolder")
            )}
          </span>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="w-full">
      {renderFolderPickerButton()}

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-md shadow-sm text-sm"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-500 dark:text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  {t("folderPicker.errorTitle")}
                </h3>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="ml-2 inline-flex text-red-400 hover:text-red-500 dark:text-red-300 dark:hover:text-red-200"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {directoryHandle && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-800 dark:text-gray-200">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-md flex items-center justify-center mr-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-blue-600 dark:text-blue-400"
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
              <div>
                <div className="font-medium text-sm flex items-center">
                  <span className="font-mono">{directoryHandle.name}</span>
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded">
                    {t("folderPicker.ready")}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t("folderPicker.selectedFolder")}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              {hasGitignore ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-green-50 dark:bg-green-900/30 rounded-md flex items-center justify-center mr-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-green-600 dark:text-green-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {t("folderPicker.gitignoreFound")}
                    </span>
                  </div>
                  <button
                    onClick={handleViewRules}
                    className="ml-2 inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 text-xs rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    {t("folderPicker.viewRules")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center w-full">
                  <div className="w-6 h-6 bg-amber-50 dark:bg-amber-900/30 rounded-md flex items-center justify-center mr-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 text-xs">
                    {t("folderPicker.gitignoreNotFound")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {renderGitignoreModal()}
    </div>
  );
}
