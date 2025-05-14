"use client";

import { useState } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  hasGitignoreAtom,
  scanStatusAtom,
  errorMessageAtom,
  gitignoreContentAtom,
  themeAtom,
} from "../lib/store";
import {
  requestDirectoryAccess,
  checkGitignoreExists,
} from "../lib/scanService";
import { useTranslations } from "./LocaleProvider";

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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col transition-colors duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              .gitignore 规则
            </h3>
            <button
              onClick={handleCloseModal}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <div className="flex-grow overflow-auto">
            {rules.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    忽略规则
                  </h4>
                  <ul className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md divide-y dark:divide-gray-600">
                    {rules.map((rule, index) => (
                      <li key={index} className="py-2 flex items-start">
                        <span className="inline-block bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm font-mono">
                          {rule}
                        </span>
                        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                          {rule.includes("*")
                            ? "通配符规则"
                            : rule.startsWith("!")
                            ? "排除规则"
                            : rule.endsWith("/")
                            ? "文件夹规则"
                            : "文件规则"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {comments.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      注释
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md text-sm text-gray-600 dark:text-gray-400">
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
                  ? ".gitignore 文件为空"
                  : "无法读取 .gitignore 规则"}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t dark:border-gray-700 text-right">
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t("settings.close")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mb-6">
      <button
        onClick={handleSelectFolder}
        disabled={isSelecting}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
      >
        {isSelecting
          ? t("folderPicker.selecting")
          : directoryHandle
          ? "更换文件夹"
          : t("folderPicker.selectFolder")}
      </button>

      {directoryHandle && (
        <div className="mt-2 text-sm">
          <p>
            已选择文件夹:{" "}
            <span className="font-medium dark:text-white">
              {directoryHandle.name}
            </span>
          </p>
          <p className="text-gray-600 dark:text-gray-400 flex items-center">
            {hasGitignore ? (
              <>
                <span className="mr-2">
                  ✓ {t("folderPicker.gitignoreFound")}
                </span>
                <button
                  onClick={handleViewRules}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-xs"
                >
                  {t("folderPicker.viewRules")}
                </button>
              </>
            ) : (
              `⚠️ ${t("folderPicker.gitignoreNotFound")}`
            )}
          </p>
        </div>
      )}

      {renderGitignoreModal()}
    </div>
  );
}
