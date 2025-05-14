"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  changeReportAtom,
  currentScanAtom,
  scanStatusAtom,
  errorMessageAtom,
  showAllFilesAtom,
  themeAtom,
} from "../lib/store";
import dynamic from "next/dynamic";
import { useTranslations } from "./LocaleProvider";

// 动态导入差异查看器组件
const DiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
});

export default function ResultDisplay() {
  const { t } = useTranslations();
  const [changeReport] = useAtom(changeReportAtom);
  const [currentScan] = useAtom(currentScanAtom);
  const [scanStatus] = useAtom(scanStatusAtom);
  const [errorMessage] = useAtom(errorMessageAtom);
  const [showAllFiles] = useAtom(showAllFilesAtom);
  const [theme] = useAtom(themeAtom);

  const [activeTab, setActiveTab] = useState<
    "structure" | "changes" | "details" | "files"
  >("structure");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // 调试用：监控状态变化
  useEffect(() => {
    console.log("当前选中文件:", selectedFile);
    console.log("当前活动标签:", activeTab);

    if (selectedFile && changeReport) {
      const file = changeReport.modifiedFiles.find(
        (f) => f.path === selectedFile
      );
      console.log("找到的文件:", file);
    }
  }, [selectedFile, activeTab, changeReport]);

  // 当无结果时的提示
  if (!currentScan) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center transition-colors duration-300">
        {scanStatus === "scanning" ? (
          <p className="text-gray-600 dark:text-gray-300">
            {t("resultDisplay.waitingForScan")}
          </p>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">
            {t("resultDisplay.selectFolderPrompt")}
          </p>
        )}

        {errorMessage && (
          <p className="mt-2 text-red-600 dark:text-red-400">{errorMessage}</p>
        )}
      </div>
    );
  }

  // 渲染项目结构
  const renderStructure = () => {
    if (!changeReport)
      return (
        <p className="text-gray-600 dark:text-gray-300">还没有项目结构信息</p>
      );

    return (
      <pre className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-auto text-sm text-gray-800 dark:text-gray-200 transition-colors duration-300">
        {changeReport.projectStructure}
      </pre>
    );
  };

  // 处理文件点击
  const handleFileClick = (filePath: string) => {
    console.log("文件被点击:", filePath);
    setSelectedFile(filePath);
    setActiveTab("details");
  };

  // 渲染变动列表
  const renderChanges = () => {
    if (!changeReport)
      return <p className="text-gray-600 dark:text-gray-300">还没有变动信息</p>;

    const hasChanges =
      changeReport.addedFiles.length > 0 ||
      changeReport.deletedFiles.length > 0 ||
      changeReport.modifiedFiles.length > 0;

    if (!hasChanges) {
      return (
        <p className="text-gray-600 dark:text-gray-300">
          {t("resultDisplay.noChanges")}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {changeReport.addedFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2 dark:text-white">
              {t("resultDisplay.addedFiles")} ({changeReport.addedFiles.length})
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              {changeReport.addedFiles.map((file) => {
                // 检查是否有对应的修改文件记录（包含diff）
                const hasFileDiff = changeReport.modifiedFiles.some(
                  (diff) => diff.path === file.path && diff.type === "added"
                );

                return (
                  <li
                    key={file.path}
                    className={`text-green-600 dark:text-green-400 ${
                      hasFileDiff ? "cursor-pointer hover:underline" : ""
                    }`}
                    onClick={
                      hasFileDiff ? () => handleFileClick(file.path) : undefined
                    }
                  >
                    {file.path}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {changeReport.deletedFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2 dark:text-white">
              {t("resultDisplay.deletedFiles")} (
              {changeReport.deletedFiles.length})
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              {changeReport.deletedFiles.map((file) => (
                <li key={file.path} className="text-red-600 dark:text-red-400">
                  {file.path}
                </li>
              ))}
            </ul>
          </div>
        )}

        {changeReport.modifiedFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-2 dark:text-white">
              {t("resultDisplay.modifiedFiles")} (
              {changeReport.modifiedFiles.length})
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              {changeReport.modifiedFiles
                .filter((file) => file.type === "modified")
                .map((file) => (
                  <li
                    key={file.path}
                    className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                    onClick={() => handleFileClick(file.path)}
                  >
                    {file.path}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // 渲染文件详情
  const renderDetails = () => {
    if (!changeReport || !selectedFile) {
      return (
        <p className="text-gray-600 dark:text-gray-300">
          请从变动列表中选择一个文件查看详情
        </p>
      );
    }

    const file = changeReport.modifiedFiles.find(
      (f) => f.path === selectedFile
    );

    if (!file) {
      return (
        <p className="text-gray-600 dark:text-gray-300">找不到所选文件的详情</p>
      );
    }

    return (
      <div className="space-y-2">
        <h3 className="text-lg font-medium dark:text-white">{file.path}</h3>
        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm transition-colors duration-300">
          <p className="dark:text-gray-200">
            文件类型:{" "}
            <span className="font-medium">
              {file.type === "added"
                ? "新增"
                : file.type === "deleted"
                ? "删除"
                : "修改"}
            </span>
          </p>
          {file.oldContent !== undefined && file.newContent !== undefined && (
            <p className="dark:text-gray-200">
              内容状态: <span className="font-medium">有文本内容</span>
            </p>
          )}
          {file.diff && (
            <p className="dark:text-gray-200">
              差异: <span className="font-medium">已生成</span>
            </p>
          )}
        </div>

        {file.oldContent !== undefined && file.newContent !== undefined ? (
          <div className="w-full overflow-auto border dark:border-gray-600 rounded mt-4">
            <DiffViewer
              oldValue={file.oldContent}
              newValue={file.newContent}
              splitView={true}
              useDarkTheme={theme === "dark"}
              leftTitle={file.type === "added" ? "不存在" : "旧版本"}
              rightTitle={file.type === "added" ? "新文件" : "新版本"}
            />
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-300 mt-4">
            无文本内容可显示差异
          </p>
        )}
      </div>
    );
  };

  // 渲染所有文件内容
  const renderAllFiles = () => {
    if (!changeReport || !changeReport.allFiles) {
      return (
        <p className="text-gray-600 dark:text-gray-300">
          没有文件内容可显示。请确保已勾选"显示所有文件内容"选项并完成扫描。
        </p>
      );
    }

    if (changeReport.allFiles.length === 0) {
      return (
        <p className="text-gray-600 dark:text-gray-300">没有找到任何文件</p>
      );
    }

    return (
      <div className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          共找到 {changeReport.allFiles.length} 个文件
        </p>

        {changeReport.allFiles.map((file) => (
          <div
            key={file.path}
            className="border-b dark:border-gray-700 pb-4 mb-4 last:border-0"
          >
            <h3 className="text-md font-medium text-blue-600 dark:text-blue-400">
              {file.path}
            </h3>
            {file.content ? (
              <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-sm overflow-auto max-h-96 text-gray-800 dark:text-gray-200 transition-colors duration-300">
                {file.content}
              </pre>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                （无法显示文件内容）
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow transition-colors duration-300">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          <button
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-300 ${
              activeTab === "structure"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("structure")}
          >
            {t("resultDisplay.structure")}
          </button>
          <button
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-300 ${
              activeTab === "changes"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("changes")}
          >
            {t("resultDisplay.changes")}
          </button>
          <button
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-300 ${
              activeTab === "details"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("details")}
            disabled={!selectedFile}
          >
            {t("resultDisplay.details")}
          </button>
          {showAllFiles && (
            <button
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-300 ${
                activeTab === "files"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("files")}
            >
              {t("resultDisplay.files")}
            </button>
          )}
        </nav>
      </div>

      <div className="p-4">
        {activeTab === "structure" && renderStructure()}
        {activeTab === "changes" && renderChanges()}
        {activeTab === "details" && renderDetails()}
        {activeTab === "files" && renderAllFiles()}
      </div>
    </div>
  );
}
