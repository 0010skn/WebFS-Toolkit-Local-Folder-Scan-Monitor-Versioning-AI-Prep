"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { useAtom } from "jotai";
import { currentScanAtom, readmeContentAtom } from "../lib/store";
import {
  findRelevantFiles,
  parseFilePathsResult,
  getKnowledgeContent,
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
  const [relevantKnowledge, setRelevantKnowledge] = useState<string[]>([]);
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
        currentScan?.entries.filter((entry) => entry.type === "file").length ||
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
    setRelevantKnowledge([]);
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
      .filter((entry) => entry.type === "file")
      .map((entry) => {
        // 查找该文件中的函数和方法信息
        const functions = currentScan.codeStructure?.functions
          .filter((func) => func.filePath === entry.path)
          .map((func) => `${func.type}:${func.name}[${func.lines.join("-")}]`);

        // 如果有函数信息，添加到文件路径中
        if (functions && functions.length > 0) {
          return `${entry.path} (${functions.join(", ")})`;
        }
        return entry.path;
      });

    // 添加调试日志
    console.log("提取的文件路径数量:", filePaths.length);
    console.log("前5个文件路径:", filePaths.slice(0, 5));
    console.log("currentScan内容:", currentScan);

    // 修改这里：不要在没有文件时立即返回错误
    if (filePaths.length === 0) {
      console.warn("没有可用的文件路径，将尝试检索知识库内容");
      // 不再提前返回错误，继续执行
    }

    // 如果启用了内容匹配，准备文件内容数据
    const fileContentMap: { [path: string]: string } = {};
    if (enableContentMatching) {
      setProcessingPhase(t("vectorReport.processingPhases.analyzing"));
      currentScan.entries
        .filter((entry) => entry.type === "file" && entry.content)
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
        enableContentMatching ? fileContentMap : undefined,
        currentScan?.codeStructure
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

      // 过滤相关路径，移除函数信息部分以获取实际的文件路径
      const relevantPaths = parsedResult.relevant_paths
        ? parsedResult.relevant_paths.map((path) => path.split(" (")[0])
        : [];

      setRelevantFiles(relevantPaths);
      setRelevantKnowledge(parsedResult.knowledge_entries || []);

      // 读取相关文件的内容
      setProcessingPhase(t("vectorReport.processingPhases.extracting"));
      const contents: { [path: string]: string } = {};

      // 查找文件内容
      if (relevantPaths && relevantPaths.length > 0) {
        for (const path of relevantPaths) {
          const fileEntry = currentScan.entries.find(
            (entry) => entry.path === path
          );
          if (fileEntry && fileEntry.content) {
            // 查找该文件中的函数和方法信息
            const functions = currentScan.codeStructure?.functions.filter(
              (func) => func.filePath === path
            );

            // 如果有函数信息，添加到文件内容中
            let enhancedContent = fileEntry.content;
            if (functions && functions.length > 0) {
              enhancedContent = `/* 文件中的函数和方法:
${functions
  .map((func) => `${func.type}: ${func.name} [行 ${func.lines.join("-")}]`)
  .join("\n")}
*/\n\n${fileEntry.content}`;
            }

            contents[path] = enhancedContent;
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
      }

      setFileContents(contents);

      // 生成结果文本
      setProcessingPhase(t("vectorReport.processingPhases.generating"));

      let textResult = `# 新任务\n\n`;
      textResult += `## 任务\n${parsedResult.query}\n\n`;
      textResult += `## 用户语言\n${navigator.language}\n\n`;

      // 只有当有文件时才添加项目结构
      if (currentScan.entries && currentScan.entries.length > 0) {
        textResult += `## 项目结构\n`;
        currentScan.entries.forEach((entry) => {
          textResult += `${entry.path}\n`;
        });
        textResult += "\n";
      }

      // 添加代码结构信息
      if (currentScan.codeStructure) {
        textResult += `## 代码结构统计\n`;
        const stats = currentScan.codeStructure;
        textResult += `- 总文件数: ${stats.totalFiles || 0}\n`;
        textResult += `- 总函数数: ${stats.totalFunctions || 0}\n`;
        textResult += `- 总方法数: ${stats.totalMethods || 0}\n`;
        textResult += `- 总类数: ${stats.totalClasses || 0}\n`;
        textResult += `- 总代码行数: ${stats.totalLines || 0}\n\n`;
      }

      // 添加相关文件列表
      if (relevantPaths && relevantPaths.length > 0) {
        textResult += `## 相关文件 (${relevantPaths.length}个)\n`;

        // 为每个文件添加函数信息
        relevantPaths.forEach((path, index) => {
          // 查找该文件中的函数和方法
          const functions = currentScan.codeStructure?.functions.filter(
            (func) => func.filePath === path
          );

          if (functions && functions.length > 0) {
            textResult += `${index + 1}. ${path}\n`;
            textResult += `   函数和方法:\n`;
            functions.forEach((func) => {
              textResult += `   - ${func.type}: ${
                func.name
              } [行 ${func.lines.join("-")}]\n`;

              // 如果有调用信息，也添加
              if (func.calls && func.calls.length > 0) {
                textResult += `     调用: ${func.calls.join(", ")}\n`;
              }
            });
          } else {
            textResult += `${index + 1}. ${path}\n`;
          }
        });
        textResult += "\n";
      } else {
        textResult += `## 相关文件\n未找到相关文件\n\n`;
      }

      // 添加相关知识库条目列表
      if (
        parsedResult.knowledge_entries &&
        parsedResult.knowledge_entries.length > 0
      ) {
        textResult += `## 相关知识库条目 (${parsedResult.knowledge_entries.length}个)\n`;

        try {
          // 获取知识库条目内容
          const knowledgeEntries = await getKnowledgeContent();
          const relevantKnowledgeEntries = knowledgeEntries.filter((entry) =>
            parsedResult.knowledge_entries.includes(entry.title)
          );

          if (relevantKnowledgeEntries.length > 0) {
            for (const entry of relevantKnowledgeEntries) {
              textResult += `### ${entry.title}\n\`\`\`markdown\n${entry.text}\n\`\`\`\n\n`;
            }
          } else {
            textResult += `未找到相关知识库条目内容\n\n`;
          }
        } catch (err) {
          console.error("获取知识库内容失败:", err);
          textResult += `获取知识库条目内容时出错\n\n`;
        }
      } else {
        textResult += `## 相关知识库条目\n未找到相关知识库条目\n\n`;
      }

      // 添加文件内容
      if (Object.keys(contents).length > 0) {
        textResult += `## 文件内容\n`;
        Object.entries(contents).forEach(([path, content]) => {
          // 添加行号到每行
          const contentWithLineNumbers = content
            .split("\n")
            .map((line, index) => `${index + 1} ${line}`)
            .join("\n");

          textResult += `\n### ${path}\n\`\`\`\n${contentWithLineNumbers}\n\`\`\`\n`;
        });
      } else {
        textResult += `## 文件内容\n未找到相关文件内容\n\n`;
      }

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

  // 渲染文件列表 - ChatGPT风格
  const renderFileList = () => {
    if (!relevantFiles.length) return null;

    return (
      <div className="mt-4 mb-5">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1.5 text-emerald-600 dark:text-emerald-400"
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
          {t("resultDisplay.filesAndFoldersCount", {
            count: String(relevantFiles.length),
          })}
        </h4>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-[180px] overflow-y-auto border border-gray-200 dark:border-gray-700">
          <ul className="list-none space-y-1">
            {relevantFiles.map((path, index) => (
              <li
                key={index}
                className="text-xs text-gray-700 dark:text-gray-300 flex items-start"
              >
                <span className="text-gray-400 dark:text-gray-500 mr-2 mt-0.5">
                  •
                </span>
                <span className="font-mono">{path}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // 渲染知识库条目列表 - ChatGPT风格
  const renderKnowledgeList = () => {
    if (!relevantKnowledge.length) return null;

    return (
      <div className="mb-5">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1.5 text-purple-600 dark:text-purple-400"
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
          {t("vectorReport.knowledgeResults", {
            count: String(relevantKnowledge.length),
          })}
        </h4>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-[180px] overflow-y-auto border border-gray-200 dark:border-gray-700">
          <ul className="list-none space-y-1">
            {relevantKnowledge.map((title, index) => (
              <li
                key={index}
                className="text-xs text-gray-700 dark:text-gray-300 flex items-start"
              >
                <span className="text-gray-400 dark:text-gray-500 mr-2 mt-0.5">
                  •
                </span>
                <span>{title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // 渲染处理阶段提示 - ChatGPT风格
  const renderProcessingPhase = () => {
    if (!isProcessing || !processingPhase) return null;

    return (
      <div className="mt-2 flex items-center text-xs text-emerald-600 dark:text-emerald-400">
        <div className="relative mr-2">
          <div className="w-3.5 h-3.5 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <span>{processingPhase}...</span>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col relative border border-gray-200 dark:border-gray-700">
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
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-500 text-white px-4 py-2 rounded-md shadow-sm flex items-center text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1.5"
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

      {/* 模态窗口标题栏 - ChatGPT风格 */}
      <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 flex items-center">
          <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md mr-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
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
          {t("vectorReport.title")}
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none transition-colors"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          {t("vectorReport.description")}
        </p>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[120px] resize-y text-sm"
              placeholder={t("vectorReport.placeholder")}
              disabled={isProcessing}
            />
          </div>

          <div className="mb-5 flex items-center">
            <input
              type="checkbox"
              id="enableContentMatching"
              checked={enableContentMatching}
              onChange={(e) => setEnableContentMatching(e.target.checked)}
              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
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
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isProcessing || !question.trim()
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin mr-2 h-4 w-4 text-current"
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
                <span className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {t("vectorReport.submit")}
                </span>
              )}
            </button>
          </div>
          {renderProcessingPhase()}
        </form>

        <div className="mt-6">
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-emerald-600 dark:text-emerald-400"
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
            {t("vectorReport.result")}
          </h3>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-lg border border-red-200 dark:border-red-800/50 text-sm"
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
                {renderKnowledgeList()}

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                      {t("vectorReport.result")} (
                      {(result.length / 1024).toFixed(1)} KB)
                    </span>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={copyResultToClipboard}
                        className="px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors flex items-center text-xs border border-gray-200 dark:border-gray-600"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400"
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
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors flex items-center text-xs"
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
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        {t("vectorReport.testPrompt")}
                      </button>
                    </div>
                  </div>

                  {/* 优化提示 - ChatGPT风格 */}
                  <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg p-3 flex items-start">
                    <div className="flex-shrink-0 text-emerald-600 dark:text-emerald-400 mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
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
                      <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        {t("vectorReport.optimization.title")}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                        {t("vectorReport.optimization.description", {
                          totalCount: String(
                            currentScan?.entries.filter(
                              (entry) => entry.type === "file"
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

                  {/* 结果预览区域 - ChatGPT风格 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400"
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
                        {t("vectorReport.resultPreview")}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {t("vectorReport.markdownFormat")}
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {result.length > 500
                          ? result.substring(0, 500) +
                            "...\n\n[内容已截断，完整内容请复制后查看]"
                          : result}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 flex items-start">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5"
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
                    <div>
                      {t("vectorReport.resultDescription")}
                      <br />
                      {t("vectorReport.copyInstructions")}
                    </div>
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

        {/* 承诺声明 - ChatGPT风格 */}
        <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 p-3 mb-4 rounded-lg text-sm flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5"
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
          <p className="text-gray-700 dark:text-gray-300 text-xs">
            {t("knowledgeModal.dataSecurityPromise")}
          </p>
        </div>
      </div>

      {/* 模态窗口底部 - ChatGPT风格 */}
      <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 text-sm font-medium"
        >
          {t("vectorReport.close")}
        </button>
      </div>
    </div>
  );
}
