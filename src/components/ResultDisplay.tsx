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
  readmeContentAtom,
} from "../lib/store";
import dynamic from "next/dynamic";
import { useTranslations } from "./LocaleProvider";
import ReactMarkdown from "react-markdown";

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
  const [readmeContent] = useAtom(readmeContentAtom);

  const [activeTab, setActiveTab] = useState<
    "documentation" | "structure" | "changes" | "details" | "files"
  >(readmeContent ? "documentation" : "structure");
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

  // 文件夹图标
  const FolderIcon = () => (
    <svg
      className="inline-block w-4 h-4 mr-1"
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z"
        clipRule="evenodd"
      />
      <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
    </svg>
  );

  // 文件图标
  const FileIcon = () => (
    <svg
      className="inline-block w-4 h-4 mr-1"
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        clipRule="evenodd"
      />
    </svg>
  );

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
                const isDirectory = file.type === "directory";

                return (
                  <li
                    key={file.path}
                    className={`text-green-600 dark:text-green-400 ${
                      hasFileDiff && !isDirectory
                        ? "cursor-pointer hover:underline"
                        : ""
                    }`}
                    onClick={
                      hasFileDiff && !isDirectory
                        ? () => handleFileClick(file.path)
                        : undefined
                    }
                  >
                    {isDirectory ? <FolderIcon /> : <FileIcon />}
                    {file.path}
                    {isDirectory ? "/" : ""}
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
              {changeReport.deletedFiles.map((file) => {
                const isDirectory = file.type === "directory";
                return (
                  <li
                    key={file.path}
                    className="text-red-600 dark:text-red-400"
                  >
                    {isDirectory ? <FolderIcon /> : <FileIcon />}
                    {file.path}
                    {isDirectory ? "/" : ""}
                  </li>
                );
              })}
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
              {changeReport.modifiedFiles.map((file) => (
                <li
                  key={file.path}
                  className={`cursor-pointer hover:underline ${
                    file.type === "added"
                      ? "text-green-600 dark:text-green-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}
                  onClick={() => handleFileClick(file.path)}
                >
                  <FileIcon />
                  {file.path}
                  <span
                    className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-opacity-20 font-medium inline-block align-middle"
                    style={{
                      backgroundColor:
                        file.type === "added"
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(37, 99, 235, 0.2)",
                    }}
                  >
                    {file.type === "added" ? "新增" : "修改"}
                  </span>
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
          {t("resultDisplay.filesAndFoldersCount").replace(
            "{count}",
            changeReport.allFiles.length.toString()
          )}
        </p>

        {changeReport.allFiles.map((file) => (
          <div
            key={file.path}
            className="border-b dark:border-gray-700 pb-4 mb-4 last:border-0"
          >
            <h3 className="text-md font-medium text-blue-600 dark:text-blue-400">
              {file.type === "directory" ? <FolderIcon /> : <FileIcon />}
              {file.path}
              {file.type === "directory" ? "/" : ""}
            </h3>
            {file.type === "file" && file.content ? (
              <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-sm overflow-auto max-h-96 text-gray-800 dark:text-gray-200 transition-colors duration-300">
                {file.content}
              </pre>
            ) : file.type === "directory" ? (
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                （{t("resultDisplay.directoryContent")}）
              </p>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                （{t("resultDisplay.noContent")}）
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 渲染README文档内容
  const renderDocumentation = () => {
    if (!readmeContent) {
      return (
        <p className="text-gray-600 dark:text-gray-300">
          没有找到README.md文件或文件无法读取
        </p>
      );
    }

    return (
      <div className="prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg max-w-none">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-auto text-gray-800 dark:text-gray-200 transition-colors duration-300">
          <ReactMarkdown>{readmeContent}</ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow transition-colors duration-300">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          {readmeContent && (
            <button
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-300 ${
                activeTab === "documentation"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("documentation")}
            >
              文档
            </button>
          )}
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
        {activeTab === "documentation" && renderDocumentation()}
        {activeTab === "structure" && renderStructure()}
        {activeTab === "changes" && renderChanges()}
        {activeTab === "details" && renderDetails()}
        {activeTab === "files" && renderAllFiles()}
      </div>
    </div>
  );
}
