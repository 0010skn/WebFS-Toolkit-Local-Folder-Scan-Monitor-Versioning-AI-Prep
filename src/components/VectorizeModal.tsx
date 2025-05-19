"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { useAtom } from "jotai";
import { currentScanAtom, readmeContentAtom } from "../lib/store";
import {
  findRelevantFiles,
  parseFilePathsResult,
} from "../lib/vectorizeService";
import AITestDialog from "./AITestDialog";

interface VectorizeModalProps {
  onClose: () => void;
}

// 定义Markdown解析后的块类型
type MarkdownBlock =
  | { type: "text"; content: string }
  | { type: "tool-card"; title: string; params?: string; result?: string }
  | { type: "code"; language?: string; content: string };

/**
 * 处理Markdown文本，解析工具调用卡片和代码块
 * @param markdown Markdown文本
 * @returns 解析后的块数组
 */
function processMarkdownWithCards(markdown: string): MarkdownBlock[] {
  // 如果输入为空，返回空数组
  if (!markdown) return [];

  const blocks: MarkdownBlock[] = [];
  console.log("开始处理Markdown，长度:", markdown.length);

  try {
    // 将文本按三个反引号分割
    const parts = markdown.split("```");

    // 第一部分是文本（如果不为空）
    if (parts[0].trim()) {
      blocks.push({ type: "text", content: parts[0].trim() });
    }

    // 处理剩余部分
    for (let i = 1; i < parts.length; i += 2) {
      // 奇数索引是代码块类型和内容
      if (i < parts.length) {
        const codeBlockHeader = parts[i].split("\n")[0].trim();
        const codeContent = parts[i]
          .substring(parts[i].indexOf("\n") + 1)
          .trim();

        // 处理工具调用卡片
        if (codeBlockHeader === "tool-card") {
          const lines = codeContent.split("\n");
          let title = "未知工具";
          let params = "";
          let result = "";
          let currentSection = "";

          for (const line of lines) {
            if (line.startsWith("工具名称:")) {
              title = line.substring("工具名称:".length).trim();
            } else if (line === "参数:") {
              currentSection = "params";
            } else if (line === "结果:") {
              currentSection = "result";
            } else if (currentSection === "params") {
              params += line + "\n";
            } else if (currentSection === "result") {
              result += line + "\n";
            }
          }

          blocks.push({
            type: "tool-card",
            title,
            params: params.trim(),
            result: result.trim(),
          });
          console.log(`添加了工具卡片: ${title}`);
        }
        // 处理普通代码块
        else if (codeContent) {
          blocks.push({
            type: "code",
            language: codeBlockHeader || undefined,
            content: codeContent,
          });
          console.log(
            `添加了代码块，语言:${codeBlockHeader || "无"}, 内容长度:${
              codeContent.length
            }`
          );
        }
      }

      // 偶数索引是文本内容
      if (i + 1 < parts.length && parts[i + 1].trim()) {
        blocks.push({ type: "text", content: parts[i + 1].trim() });
      }
    }

    console.log(`Markdown处理完成，共${blocks.length}个块`);
  } catch (error) {
    console.error("解析Markdown出错:", error);
    // 出错时返回整个文本作为一个块
    blocks.push({ type: "text", content: markdown });
    console.log("解析出错，将整个文本作为一个块返回");
  }

  return blocks;
}

export default function VectorizeModal({ onClose }: VectorizeModalProps) {
  const { t } = useTranslations();
  const [question, setQuestion] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [currentScan] = useAtom(currentScanAtom);
  const [readmeContent] = useAtom(readmeContentAtom);
  const [relevantFiles, setRelevantFiles] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<{ [path: string]: string }>(
    {}
  );
  const [enableContentMatching, setEnableContentMatching] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<string>("");
  const [tokensSaved, setTokensSaved] = useState<number>(0);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showAITestDialog, setShowAITestDialog] = useState(false);
  const [filePaths, setFilePaths] = useState<string[]>([]);

  // 计算预估节省的tokens
  useEffect(() => {
    if (result && relevantFiles.length > 0) {
      // 估算节省的tokens：整个项目文件数 - 相关文件数量，每个文件平均200 tokens
      const totalFiles =
        currentScan?.entries.filter((entry) => entry.kind === "file").length ||
        0;
      const savedFiles = totalFiles - relevantFiles.length;
      const estimatedTokens = savedFiles * 200;
      setTokensSaved(estimatedTokens);

      // 显示成功提示，3秒后自动消失
      setShowSuccessToast(true);
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [result, relevantFiles, currentScan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !currentScan) return;

    setIsProcessing(true);
    setError("");
    setResult("");
    setRelevantFiles([]);
    setFileContents({});
    setProcessingPhase(t("vectorReport.processingPhases.initializing"));

    try {
      // 所有查询都使用文件路径定位功能
      await handleFilePathLocator(question);
      setIsProcessing(false);
      setProcessingPhase("");
    } catch (err) {
      console.error("向量化处理出错:", err);
      setError(t("vectorReport.error"));
      setIsProcessing(false);
      setProcessingPhase("");
    }
  };

  // 处理文件路径定位请求
  const handleFilePathLocator = async (query: string) => {
    if (!currentScan) return;

    // 提取所有文件路径和内容（如果启用了内容匹配）
    setProcessingPhase(t("vectorReport.processingPhases.collecting"));
    const filePaths = currentScan.entries
      .filter((entry) => entry.kind === "file")
      .map((entry) => entry.path);

    if (filePaths.length === 0) {
      setError(t("vectorReport.noResult"));
      return;
    }

    // 如果启用了内容匹配，准备文件内容数据
    const fileContentMap: { [path: string]: string } = {};
    if (enableContentMatching) {
      setProcessingPhase(t("vectorReport.processingPhases.analyzing"));
      currentScan.entries
        .filter((entry) => entry.kind === "file" && entry.content)
        .forEach((entry) => {
          fileContentMap[entry.path] = entry.content || "";
        });
    }

    try {
      // 调用文件路径定位API，传递内容匹配选项
      setProcessingPhase(t("vectorReport.processingPhases.computing"));
      const jsonResult = await findRelevantFiles(
        query,
        filePaths,
        enableContentMatching ? fileContentMap : undefined
      );
      console.log("API返回结果:", jsonResult);

      // 解析返回的JSON结果
      setProcessingPhase(t("vectorReport.processingPhases.parsing"));
      const parsedResult = parseFilePathsResult(jsonResult);
      console.log("解析后的结果:", parsedResult);

      // 确保query字段不为空
      if (!parsedResult.query) {
        parsedResult.query = query;
      }

      setRelevantFiles(parsedResult.relevant_paths);

      // 读取相关文件的内容
      setProcessingPhase(t("vectorReport.processingPhases.extracting"));
      const contents: { [path: string]: string } = {};

      // 查找文件内容
      for (const path of parsedResult.relevant_paths) {
        const fileEntry = currentScan.entries.find(
          (entry) => entry.path === path
        );
        if (fileEntry && fileEntry.content) {
          contents[path] = fileEntry.content;
        } else if (fileEntry) {
          // 如果找到了文件但没有内容，可能是因为文件太大或非文本文件
          contents[path] = `[文件内容不可用: ${
            fileEntry.size
              ? (fileEntry.size / 1024).toFixed(2) + "KB"
              : "未知大小"
          }]`;
        } else {
          contents[path] = "[文件未找到]";
        }
      }

      // 获取所有项目文件路径
      const allFilePaths = currentScan.entries
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.path);

      // 获取所有MD文件内容
      const mdFiles: { [path: string]: string } = {};
      currentScan.entries
        .filter(
          (entry) =>
            entry.kind === "file" && entry.path.toLowerCase().endsWith(".md")
        )
        .forEach((entry) => {
          if (entry.content) {
            mdFiles[entry.path] = entry.content;
          }
        });

      setFileContents(contents);

      // 生成结果文本
      setProcessingPhase(t("vectorReport.processingPhases.generating"));

      let textResult = `# 新任务\n\n`;
      textResult += `## 任务\n${parsedResult.query}\n\n`;
      textResult += `## 用户语言\n${navigator.language}\n\n`;

      textResult += `## 项目结构\n`;
      currentScan.entries.forEach((entry) => {
        textResult += `${entry.path}\n`;
      });
      textResult += "\n";

      // 添加相关文件列表
      textResult += `## 相关文件 (${parsedResult.relevant_paths.length}个)\n`;
      parsedResult.relevant_paths.forEach((path, index) => {
        textResult += `${index + 1}. ${path}\n`;
      });
      textResult += "\n";

      // 添加文件内容
      textResult += `## 文件内容\n`;
      Object.entries(contents).forEach(([path, content]) => {
        textResult += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      });
      // 生成可视化结果显示，但实际使用文本格式
      setResult(textResult);

      setFilePaths(filePaths);
    } catch (error) {
      console.error("解析文件路径结果出错:", error);
      setError(t("vectorReport.error"));
    }
  };

  // 复制结果到剪贴板
  const copyResultToClipboard = () => {
    if (!result) return;

    navigator.clipboard
      .writeText(result)
      .then(() => {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      })
      .catch((err) => {
        console.error("复制失败:", err);
        alert(t("vectorReport.error"));
      });
  };

  // 使用AI测试向量化结果
  const handleTestWithAI = async () => {
    if (!result) return;
    setShowAITestDialog(true);
  };

  // 渲染文件列表
  const renderFileList = () => {
    if (!relevantFiles.length) return null;

    return (
      <div className="mt-4 mb-6">
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">
          {t("resultDisplay.filesAndFoldersCount", {
            count: String(relevantFiles.length),
          })}
        </h4>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 max-h-[200px] overflow-y-auto">
          <ul className="list-disc pl-5 space-y-1">
            {relevantFiles.map((path, index) => (
              <li
                key={index}
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {path}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // 渲染处理阶段提示
  const renderProcessingPhase = () => {
    if (!isProcessing || !processingPhase) return null;

    return (
      <div className="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400">
        <div className="relative mr-2">
          <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <span>{processingPhase}...</span>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col relative">
      {/* AI测试对话框 */}
      {showAITestDialog && (
        <AITestDialog
          onClose={() => setShowAITestDialog(false)}
          initialPrompt={result}
          projectFilePaths={filePaths}
        />
      )}

      {/* 成功提示 */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {t("vectorReport.resultCopied")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 模态窗口标题栏 */}
      <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2"
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
          {t("vectorReport.title")}
        </h2>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 focus:outline-none"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 模态窗口内容 */}
      <div className="p-6 flex-1 overflow-y-auto">
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {t("vectorReport.description")}
        </p>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[100px] resize-y"
              placeholder={t("vectorReport.placeholder")}
              disabled={isProcessing}
            />
          </div>

          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              id="enableContentMatching"
              checked={enableContentMatching}
              onChange={(e) => setEnableContentMatching(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isProcessing}
            />
            <label
              htmlFor="enableContentMatching"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              {t("vectorReport.enableContentMatching")}
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isProcessing || !question.trim()}
              className={`px-4 py-2 rounded-md text-white transition-colors ${
                isProcessing || !question.trim()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  {t("vectorReport.processing")}
                </span>
              ) : (
                t("vectorReport.submit")
              )}
            </button>
          </div>
          {renderProcessingPhase()}
        </form>

        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t("vectorReport.result")}
          </h3>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-md"
              >
                {error}
              </motion.div>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col"
              >
                {renderFileList()}

                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {t("vectorReport.result")} (
                      {(result.length / 1024).toFixed(1)} KB)
                    </span>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={copyResultToClipboard}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex items-center text-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        {t("vectorReport.copyPrompt")}
                      </button>
                      <button
                        onClick={handleTestWithAI}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors flex items-center text-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
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
                        {t("vectorReport.testPrompt")}
                      </button>
                    </div>
                  </div>

                  {/* 优化提示 */}
                  <div className="mb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 flex items-start">
                    <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-1 mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-blue-600 dark:text-blue-300"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        {t("vectorReport.optimization.title")}
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        {t("vectorReport.optimization.description", {
                          totalCount: String(
                            currentScan?.entries.filter(
                              (entry) => entry.kind === "file"
                            ).length || 0
                          ),
                          relevantCount: String(relevantFiles.length),
                          tokenCount: tokensSaved.toLocaleString(),
                          efficiencyFactor: String(
                            Math.round(tokensSaved / 1000)
                          ),
                        })}
                      </p>
                    </div>
                  </div>

                  {/* 结果预览区域 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("vectorReport.resultPreview")}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t("vectorReport.markdownFormat")}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-[200px] overflow-y-auto">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {result.length > 500
                          ? result.substring(0, 500) +
                            "...\n\n[内容已截断，完整内容请复制后查看]"
                          : result}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("vectorReport.resultDescription")}
                    <br />
                    {t("vectorReport.copyInstructions")}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-gray-500 dark:text-gray-400 italic"
              >
                {t("vectorReport.noResult")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 模态窗口底部 */}
      <div className="bg-gray-100 dark:bg-gray-750 px-6 py-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
        >
          {t("vectorReport.close")}
        </button>
      </div>
    </div>
  );
}
