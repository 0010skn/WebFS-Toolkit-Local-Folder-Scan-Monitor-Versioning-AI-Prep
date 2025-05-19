"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import {
  testWithAI,
  findRelevantFiles,
  parseFilePathsResult,
} from "../lib/vectorizeService";
import Markdown from "markdown-to-jsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useTheme } from "next-themes";
import { useAtom } from "jotai";
import { currentScanAtom } from "../lib/store";

interface AITestDialogProps {
  onClose: () => void;
  initialPrompt: string;
  projectFilePaths?: string[];
}

// 定义对话选项类型
interface DialogOption {
  id: string;
  text: string;
}

// 自定义代码块组件
const CodeBlock = ({
  className,
  children,
}: {
  className?: string;
  children: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const language = className ? className.replace(/language-/, "") : "";
  const [copied, setCopied] = useState(false);

  // 高亮块动画
  const handleCopy = () => {
    navigator.clipboard.writeText(children || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      className="bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden my-2 max-w-full"
      initial={{ opacity: 0.9, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="bg-gray-200 dark:bg-gray-600 px-4 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
        <span className="flex items-center">
          {language && (
            <span
              className="w-3 h-3 rounded-full mr-2"
              style={{
                backgroundColor: getLanguageColor(language),
              }}
            ></span>
          )}
          {language || "code"}
        </span>
        <motion.button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-md flex items-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {copied ? (
            <motion.span
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-green-500 dark:text-green-400 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              已复制
            </motion.span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
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
          )}
        </motion.button>
      </div>
      <motion.div
        className="overflow-x-auto"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <SyntaxHighlighter
          language={language || "text"}
          style={isDark ? vscDarkPlus : vs}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            backgroundColor: isDark ? "rgb(30, 30, 30)" : "rgb(250, 250, 250)",
          }}
          wrapLines={true}
          wrapLongLines={true}
          showLineNumbers={language !== "text" && language !== ""}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)",
            borderRight: isDark
              ? "1px solid rgba(255, 255, 255, 0.1)"
              : "1px solid rgba(0, 0, 0, 0.1)",
            marginRight: "1em",
          }}
        >
          {children}
        </SyntaxHighlighter>
      </motion.div>
    </motion.div>
  );
};

// 获取编程语言的颜色
const getLanguageColor = (language: string): string => {
  const colorMap: { [key: string]: string } = {
    javascript: "#f7df1e",
    typescript: "#3178c6",
    jsx: "#61dafb",
    tsx: "#3178c6",
    python: "#3572A5",
    java: "#b07219",
    cpp: "#f34b7d",
    csharp: "#178600",
    php: "#4F5D95",
    ruby: "#CC342D",
    go: "#00ADD8",
    rust: "#DEA584",
    html: "#e34c26",
    css: "#563d7c",
    json: "#292929",
    bash: "#89e051",
    shell: "#89e051",
    sql: "#e38c00",
    markdown: "#083fa1",
  };

  return colorMap[language.toLowerCase()] || "#aaa";
};

// 自定义工具调用卡片组件
const ToolCard = ({ children }: { children: React.ReactNode }) => {
  // 确保children是字符串
  const content = typeof children === "string" ? children : "";
  const lines = content.split("\n");
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

  return (
    <div className="my-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-w-full">
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 font-medium flex items-center justify-between">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm truncate">{title}</span>
        </div>
        <span className="text-xs opacity-70 flex-shrink-0">工具调用</span>
      </div>
      <div className="p-3">
        {params && (
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              参数:
            </div>
            <div className="bg-white/80 dark:bg-gray-900/50 rounded p-2 text-sm overflow-x-auto">
              {params.split("\n").map((param, k) => (
                <div
                  key={k}
                  className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words"
                >
                  {param}
                </div>
              ))}
            </div>
          </div>
        )}
        {result && (
          <div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              结果:
            </div>
            <div className="bg-white/80 dark:bg-gray-900/50 rounded p-2 text-sm overflow-x-auto">
              {result.split("\n").map((line, k) => (
                <div
                  key={k}
                  className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 修改FileIndexCard组件
const FileIndexCard = ({ data }: { data?: string }) => {
  // 解析传入的数据
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    // 在组件挂载后安全地解析数据
    try {
      if (data) {
        const decoded = decodeURIComponent(data);
        const parsed = JSON.parse(decoded);

        if (Array.isArray(parsed)) {
          // 如果已经是数组，直接使用
          setFiles(parsed.filter((item) => typeof item === "string"));
        } else if (parsed && typeof parsed === "object") {
          // 如果是对象，转换为字符串数组
          const values = Object.values(parsed);
          setFiles(values.filter((item) => typeof item === "string"));
        } else {
          // 其他情况设为空数组
          setFiles([]);
        }
      } else {
        setFiles([]);
      }
    } catch (error) {
      console.error("解析文件索引数据出错:", error, data);
      setFiles([]);
    }
  }, [data]);

  return (
    <div className="my-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-w-full">
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 font-medium flex items-center justify-between">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2 text-purple-500 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">相关文件</span>
        </div>
        <span className="text-xs opacity-70 flex-shrink-0">自动索引</span>
      </div>
      <div className="p-3">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          已为您索引以下相关文件:
        </div>

        <div className="bg-white/80 dark:bg-gray-900/50 rounded p-2 max-h-40 overflow-y-auto overflow-x-auto">
          {Array.isArray(files) && files.length > 0 ? (
            files.map((file, index) => (
              <div
                key={index}
                className="font-mono text-xs text-gray-700 dark:text-gray-300 py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0 whitespace-pre-wrap break-words"
              >
                {file}
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
              未找到相关文件
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AITestDialog({
  onClose,
  initialPrompt,
  projectFilePaths = [],
}: AITestDialogProps) {
  const { t } = useTranslations();
  const { resolvedTheme } = useTheme();

  // 对话选项动画设置
  const optionHoverStyle = {
    backgroundColor:
      resolvedTheme === "dark"
        ? "rgba(55, 65, 81, 0.7)"
        : "rgba(243, 244, 246, 0.7)",
    x: 2,
  };

  // 定义对话轮次类型
  interface DialogRound {
    userInput: string;
    aiResponse: string;
    files?: string[];
    responseFiles?: string[];
    elementRef?: React.RefObject<HTMLDivElement>;
  }

  // 移除单一testResult状态，改为存储每轮对话的数组
  const [dialogRounds, setDialogRounds] = useState<DialogRound[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [dialogOptions, setDialogOptions] = useState<DialogOption[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const maxRounds = 20;
  const [showOptions, setShowOptions] = useState(false);
  const [responseSegments, setResponseSegments] = useState<{
    [key: number]: string;
  }>({});
  const [indexedFiles, setIndexedFiles] = useState<string[]>([]);
  const [filePaths] = useState<string[]>(projectFilePaths);
  const [lastChar, setLastChar] = useState<string>("");
  const [animationKey, setAnimationKey] = useState<number>(0);
  // 当前正在构建的响应
  const [currentResponse, setCurrentResponse] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [currentScan] = useAtom(currentScanAtom);
  // 新增当前轮次的引用
  const currentRoundRef = useRef<HTMLDivElement>(null);

  // 自动滚动到当前AI回复的开头位置
  const scrollToCurrentResponse = useCallback(() => {
    if (currentRoundRef.current) {
      currentRoundRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (contentRef.current) {
      // 如果找不到当前轮次的引用，则滚动到底部
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [currentRoundRef]);

  // 监听AI回复完成，自动滚动到当前轮次开头
  useEffect(() => {
    if (!isTesting && dialogRounds.length > 0 && currentRound > 0) {
      // AI回复完成时滚动到当前回复开头
      scrollToCurrentResponse();
    }
  }, [isTesting, dialogRounds.length, currentRound, scrollToCurrentResponse]);

  // 自动滚动到底部 - 保留原有的滚动逻辑，但不在上面的效果触发时执行
  useEffect(() => {
    if (contentRef.current && isTesting) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [dialogRounds, currentResponse, isTesting]);

  // 开始测试
  useEffect(() => {
    if (initialPrompt) {
      startTest();
    }
  }, [initialPrompt]);

  const startTest = async () => {
    setIsTesting(true);
    setDialogRounds([]);
    setCurrentRound(0);
    setIsComplete(false);
    setConversationHistory([{ role: "user", content: initialPrompt }]);
    setResponseSegments({});
    setIndexedFiles([]);
    setLastChar("");
    setAnimationKey(0);
    setCurrentResponse("");
    setIsIndexing(true);

    try {
      // 获取项目文件路径列表
      const paths = filePaths.length > 0 ? filePaths : [];

      // 从currentScan中提取文件内容
      const fileContents: { [path: string]: string } = {};
      if (paths.length > 0) {
        // 查找相关文件并传递文件内容
        paths.forEach((path) => {
          // 从当前扫描结果中查找文件内容
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.kind === "file"
          );
          if (entry && entry.content) {
            fileContents[path] = entry.content;
          }
        });
      }

      // 查找相关文件，传递文件内容以提高相关性
      const jsonResult = await findRelevantFiles(
        initialPrompt,
        paths,
        fileContents
      );
      const parsedResult = parseFilePathsResult(jsonResult);
      setIndexedFiles(parsedResult.relevant_paths);
      setIsIndexing(false);

      // 创建并设置第一轮对话对象
      setDialogRounds([
        {
          userInput: initialPrompt,
          aiResponse: "",
          files:
            parsedResult.relevant_paths.length > 0
              ? parsedResult.relevant_paths
              : undefined,
          elementRef: currentRoundRef,
        },
      ]);

      // 构建增强的提示，包含文件内容
      let enhancedPrompt = initialPrompt;
      if (parsedResult.relevant_paths.length > 0) {
        enhancedPrompt += "\n\n相关文件内容:\n\n";

        for (const path of parsedResult.relevant_paths) {
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.kind === "file"
          );
          if (entry && entry.content) {
            // 限制文件内容长度
            const truncatedContent =
              entry.content.length > 30000
                ? entry.content.substring(0, 30000) + "..."
                : entry.content;

            enhancedPrompt += `文件: ${path}\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
          }
        }

        // 添加明确指示，避免AI调用工具
        enhancedPrompt +=
          "\n\n请直接基于以上提供的文件内容回答问题，不要调用工具来获取文件内容，因为所有必要的文件内容已经提供给你了。";
      }

      // 只进行第一轮对话，后续轮次由用户选择
      let response = "";

      // 对话轮次已经通过之前的状态更新添加，这里不需要重复设置

      await testWithAI(
        enhancedPrompt,
        (chunk) => {
          // 更新最后一个字符用于动画
          setLastChar(chunk);
          // 更新动画键以触发新动画
          setAnimationKey((prev) => prev + 1);
          // 累积响应到当前响应
          setCurrentResponse((prev) => prev + chunk);
          response += chunk;

          // 实时更新对话轮次中的AI响应
          setDialogRounds((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[0] = {
                ...updated[0],
                aiResponse: response,
              };
            }
            return updated;
          });
        },
        true // 只进行第一轮
      );

      // 更新第一轮对话的AI响应
      setDialogRounds((prev) => {
        if (prev.length > 0) {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            aiResponse: response,
          };
          return updated;
        }
        return [{ userInput: initialPrompt, aiResponse: response }];
      });
      setCurrentRound(1);
      setCurrentResponse("");

      // 保存第一轮响应
      setResponseSegments((prev) => ({ ...prev, 1: response }));

      // 第一轮对话结束后，根据AI响应重新生成文件索引
      try {
        // 添加延迟，确保UI更新完成
        setTimeout(async () => {
          try {
            const newJsonResult = await findRelevantFiles(
              response,
              paths,
              fileContents
            );
            const newParsedResult = parseFilePathsResult(newJsonResult);
            const responseIndexedFiles = newParsedResult.relevant_paths;

            // 如果找到了新的相关文件，更新索引
            if (responseIndexedFiles.length > 0) {
              setIndexedFiles(responseIndexedFiles);
              setDialogRounds((prev) => {
                if (prev.length > 0) {
                  const updated = [...prev];
                  updated[0] = {
                    ...updated[0],
                    responseFiles: responseIndexedFiles,
                  };
                  return updated;
                }
                return prev;
              });
            }
          } catch (innerError) {
            console.error("延迟更新文件索引出错:", innerError);
          }
        }, 500);
      } catch (indexError) {
        console.error("更新文件索引出错:", indexError);
      }

      // 第一轮对话已经通过状态更新添加，不需要重复设置

      // 生成对话选项
      generateDialogOptions(initialPrompt, response);
      // 默认不显示选项
      setShowOptions(false);
    } catch (error) {
      console.error("AI测试出错:", error);
      setDialogRounds([
        {
          userInput: initialPrompt,
          aiResponse: t("vectorReport.error"),
        },
      ]);
      setIsIndexing(false);
    } finally {
      setIsTesting(false);
    }
  };

  // 继续对话
  const continueConversation = async (input: string) => {
    if (isComplete || currentRound >= maxRounds) {
      return;
    }

    setIsTesting(true);
    setShowOptions(false);
    setLastChar("");
    setAnimationKey(0);
    setCurrentResponse("");
    setIsIndexing(true);

    // 创建新的对话轮次
    const newRound: DialogRound = {
      userInput: input,
      aiResponse: "",
      elementRef: currentRoundRef,
    };

    // 更新对话历史
    const updatedHistory = [
      ...conversationHistory,
      { role: "assistant", content: responseSegments[currentRound] || "" },
      { role: "user", content: input },
    ];
    setConversationHistory(updatedHistory);

    // 清空自定义输入
    setCustomInput("");

    try {
      // 获取项目文件路径列表
      const paths = filePaths.length > 0 ? filePaths : [];

      // 从currentScan中提取文件内容
      const fileContents: { [path: string]: string } = {};
      if (paths.length > 0) {
        // 查找相关文件并传递文件内容
        paths.forEach((path) => {
          // 从当前扫描结果中查找文件内容
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.kind === "file"
          );
          if (entry && entry.content) {
            fileContents[path] = entry.content;
          }
        });
      }

      // 查找相关文件，传递文件内容以提高相关性
      const jsonResult = await findRelevantFiles(input, paths, fileContents);
      const parsedResult = parseFilePathsResult(jsonResult);
      const newIndexedFiles = parsedResult.relevant_paths;
      setIndexedFiles(newIndexedFiles);
      setIsIndexing(false);

      // 如果找到了相关文件，添加到当前轮次
      if (newIndexedFiles.length > 0) {
        newRound.files = newIndexedFiles;
      }

      // 添加新轮次到对话轮次数组，以便UI立即显示用户消息
      setDialogRounds((prev) => [...prev, newRound]);

      // 构建增强的提示，包含文件内容
      let enhancedInput = input;
      if (newIndexedFiles.length > 0) {
        enhancedInput += "\n\n相关文件内容:\n\n";

        for (const path of newIndexedFiles) {
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.kind === "file"
          );
          if (entry && entry.content) {
            // 限制文件内容长度，但增加到3000字符以包含更多上下文
            const truncatedContent =
              entry.content.length > 3000
                ? entry.content.substring(0, 3000) + "..."
                : entry.content;

            enhancedInput += `文件: ${path}\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
          }
        }

        // 添加明确指示，避免AI调用工具
        enhancedInput +=
          "\n\n请直接基于以上提供的文件内容回答问题，不要调用工具来获取文件内容，因为所有必要的文件内容已经提供给你了。";
      }

      // 构建系统提示
      const nextRound = currentRound + 1;
      const systemPrompt = `这是第${nextRound}/${maxRounds}轮对话。
我已经为您索引了与当前对话相关的文件，并且已经在用户消息中提供了这些文件的完整内容。
请直接基于用户消息中提供的文件内容回答问题，不要尝试调用工具来获取文件内容。
请根据这些文件内容和对话历史提供详细分析。${
        nextRound === maxRounds
          ? "这是最后一轮对话，请在回复结束时提醒用户测试完毕并做出总结。"
          : ""
      }`;

      // 更新对话历史中的最后一个用户消息，使用增强的提示
      const enhancedHistory = [
        ...updatedHistory.slice(0, -1),
        { role: "user", content: enhancedInput },
      ];

      // 调用API获取响应
      let response = "";
      await testWithAI(
        enhancedInput,
        (chunk) => {
          // 更新最后一个字符用于动画
          setLastChar(chunk);
          // 更新动画键以触发新动画
          setAnimationKey((prev) => prev + 1);
          // 累积响应到当前响应
          setCurrentResponse((prev) => prev + chunk);
          response += chunk;

          // 实时更新对话轮次中的AI响应
          setDialogRounds((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              const lastIndex = updated.length - 1;
              updated[lastIndex] = {
                ...updated[lastIndex],
                aiResponse: response,
              };
            }
            return updated;
          });
        },
        false, // 不是第一轮
        enhancedHistory,
        systemPrompt
      );

      // 更新当前轮次的AI响应
      // 使用状态更新而不是直接修改对象
      setDialogRounds((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          const lastIndex = updated.length - 1;
          updated[lastIndex] = {
            ...updated[lastIndex],
            aiResponse: response,
          };
        }
        return updated;
      });

      // 保存当前轮次响应
      setResponseSegments((prev) => ({ ...prev, [nextRound]: response }));

      // 更新对话历史和轮次
      setConversationHistory([
        ...enhancedHistory,
        { role: "assistant", content: response },
      ]);
      setCurrentRound(nextRound);
      setCurrentResponse("");

      // 检查是否完成所有轮次
      if (nextRound >= maxRounds) {
        setIsComplete(true);
      } else {
        // 每轮对话结束后，根据新的响应重新生成文件索引
        try {
          // 添加延迟，确保UI更新完成
          setTimeout(async () => {
            try {
              const newJsonResult = await findRelevantFiles(
                response,
                paths,
                fileContents
              );
              const newParsedResult = parseFilePathsResult(newJsonResult);
              const responseIndexedFiles = newParsedResult.relevant_paths;

              // 如果找到了新的相关文件，更新索引
              if (responseIndexedFiles.length > 0) {
                setIndexedFiles(responseIndexedFiles);
                setDialogRounds((prev) => {
                  if (prev.length > 0) {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      responseFiles: responseIndexedFiles,
                    };
                    return updated;
                  }
                  return prev;
                });
              }
            } catch (innerError) {
              console.error("延迟更新文件索引出错:", innerError);
            }
          }, 500);
        } catch (indexError) {
          console.error("更新文件索引出错:", indexError);
        }

        // 生成新的对话选项
        generateDialogOptions(input, response);
        // 默认不显示选项
        setShowOptions(false);
      }

      // 对话轮次数组已经通过前面的状态更新进行了修改，不需要再次设置
    } catch (error) {
      console.error("AI对话继续出错:", error);
      newRound.aiResponse = t("vectorReport.error");
      setDialogRounds((prev) => [...prev, newRound]);
      setIsIndexing(false);
    } finally {
      setIsTesting(false);
    }
  };

  // 修改渲染单个对话轮次的函数
  const renderDialogRound = (round: DialogRound, index: number) => {
    const isLastRound = index === dialogRounds.length - 1;
    const isAITyping = isLastRound && isTesting;
    const isFirstRound = index === 0; // 检查是否是第一轮对话

    // 计算token
    const userTokens = round.userInput?.length || 0;
    const aiTokens = round.aiResponse?.length || 0;

    return (
      <div
        key={`round-${index}`}
        className="mb-2"
        // 如果是当前轮次，添加ref
        ref={isLastRound ? currentRoundRef : undefined}
      >
        {/* 用户消息 - 第一轮不显示 */}
        {!isFirstRound && (
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-white mr-2 sm:mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 sm:h-5 sm:w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="font-medium text-gray-900 dark:text-white mb-1 text-sm sm:text-base">
                用户
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-full text-xs sm:text-sm break-words">
                {round.userInput}
              </div>
            </div>
          </div>
        )}

        {/* AI消息 */}
        <div className="flex items-start mb-6">
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-white mr-2 sm:mr-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 sm:h-5 sm:w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="font-medium text-gray-900 dark:text-white mb-1 text-sm sm:text-base">
              AI助手
            </div>

            {/* 文件索引卡片 - 如果有的话 */}
            {round.files &&
              Array.isArray(round.files) &&
              round.files.length > 0 && (
                <div className="mb-3 overflow-hidden">
                  <FileIndexCard
                    data={encodeURIComponent(JSON.stringify(round.files))}
                  />
                </div>
              )}

            {/* AI响应内容 */}
            <div className="prose prose-sm dark:prose-invert w-full overflow-x-auto text-xs sm:text-sm break-words">
              <Markdown
                options={{
                  overrides: {
                    pre: {
                      component: ({ children }: any) => {
                        return <>{children}</>;
                      },
                    },
                    code: {
                      component: CodeBlock,
                    },
                    ToolCard: {
                      component: ToolCard,
                    },
                    FileIndexCard: {
                      component: FileIndexCard,
                    },
                    p: {
                      // 自定义段落组件，确保文本可以换行
                      component: (props: any) => (
                        <p className="whitespace-pre-wrap break-words">
                          {props.children}
                        </p>
                      ),
                    },
                  },
                }}
              >
                {processMarkdown(round.aiResponse)}
              </Markdown>

              {/* 显示打字动画效果 */}
              {isAITyping && (
                <motion.span
                  key={animationKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="inline-block ml-1"
                >
                  <motion.span
                    className="inline-block w-1.5 h-4 bg-blue-500 dark:bg-blue-400 rounded-sm"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  ></motion.span>
                </motion.span>
              )}
            </div>

            {/* Token计数和复制按钮 */}
            {!isAITyping && round.aiResponse && (
              <motion.div
                className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-md px-2 sm:px-3 py-1.5 border border-gray-200 dark:border-gray-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center space-x-3 mb-1.5 sm:mb-0">
                  <span>
                    输入{" "}
                    <span className="font-mono font-medium">{userTokens}</span>{" "}
                    tokens
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>
                    输出{" "}
                    <span className="font-mono font-medium">{aiTokens}</span>{" "}
                    tokens
                  </span>
                </div>
                <motion.button
                  onClick={() => {
                    navigator.clipboard.writeText(round.aiResponse);
                  }}
                  className="flex items-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors self-end sm:self-auto rounded-md px-2 py-1"
                  whileHover={{
                    scale: 1.05,
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                  }}
                  whileTap={{ scale: 0.95 }}
                  title="复制AI回复"
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
                  <span>复制</span>
                </motion.button>
              </motion.div>
            )}

            {/* 响应后的文件索引 */}
            {round.responseFiles &&
              Array.isArray(round.responseFiles) &&
              round.responseFiles.length > 0 && (
                <div className="mt-3 overflow-hidden">
                  <FileIndexCard
                    data={encodeURIComponent(
                      JSON.stringify(round.responseFiles)
                    )}
                  />
                </div>
              )}
          </div>
        </div>
      </div>
    );
  };

  // 处理markdown中的特殊块
  const processMarkdown = (markdown: string) => {
    if (!markdown) return "";

    let processed = markdown;

    // 替换工具调用卡片
    processed = processed.replace(
      /```tool-card([\s\S]*?)```/g,
      (match, content) => {
        return `<ToolCard>${content}</ToolCard>`;
      }
    );

    // 替换文件索引卡片 - 在对话轮次中已经单独处理，这里只处理嵌入在AI响应中的卡片
    processed = processed.replace(
      /```file-index-card([\s\S]*?)```/g,
      (match, content) => {
        try {
          // 安全地处理文件列表
          let fileList: string[] = [];

          if (content && typeof content === "string") {
            fileList = content
              .trim()
              .split("\n")
              .filter((f) => f && typeof f === "string" && f.trim() !== "");
          }

          // 确保传递的是有效的JSON字符串数组
          const safeData = encodeURIComponent(JSON.stringify(fileList));
          return `<FileIndexCard data="${safeData}" />`;
        } catch (error) {
          console.error("处理文件索引卡片出错:", error);
          // 出错时传递空数组
          return `<FileIndexCard data="${encodeURIComponent(
            JSON.stringify([])
          )}" />`;
        }
      }
    );

    // 处理表格，确保表格可以水平滚动
    processed = processed.replace(
      /(<table[\s\S]*?<\/table>)/g,
      '<div class="overflow-x-auto max-w-full">$1</div>'
    );

    // 确保长链接会换行
    processed = processed.replace(
      /(\[.*?\]\(.*?\))/g,
      '<span class="break-all">$1</span>'
    );

    return processed;
  };

  // 生成对话选项
  const generateDialogOptions = async (
    userInput: string,
    aiResponse: string
  ) => {
    try {
      // 构建提示，要求AI生成三个后续问题选项
      const optionsPrompt = `
基于以下对话，生成三个有意义的后续问题选项，这些问题应该能够帮助用户更深入地了解项目或解决问题。
请确保问题多样化，覆盖不同的方面，并且与上下文相关。
只返回JSON格式的选项列表，不要包含任何其他文本。格式如下：
[
  {"id": "option1", "text": "问题1"},
  {"id": "option2", "text": "问题2"},
  {"id": "option3", "text": "问题3"}
]

用户输入:
${userInput}

AI响应:
${aiResponse}
`;

      // 调用API获取选项
      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "",
          messages: [
            { role: "system", content: "你是一个帮助生成对话选项的助手。" },
            { role: "user", content: optionsPrompt },
          ],
          referrer: "FoldaScan",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;

      // 尝试解析JSON
      try {
        // 找到JSON部分 - 使用不含s标志的正则表达式
        const jsonRegex = /\[\s*\{[\s\S]*\}\s*\]/;
        const jsonMatch = content.match(jsonRegex);
        const jsonContent = jsonMatch ? jsonMatch[0] : content;
        const options = JSON.parse(jsonContent);

        if (Array.isArray(options) && options.length > 0) {
          setDialogOptions(options);
        } else {
          // 如果解析失败，使用默认选项
          setDialogOptions([
            { id: "option1", text: "请详细解释项目的核心功能" },
            { id: "option2", text: "这个项目的技术架构是什么?" },
            { id: "option3", text: "有哪些关键组件和它们的作用?" },
          ]);
        }
      } catch (error) {
        console.error("解析选项JSON出错:", error);
        // 使用默认选项
        setDialogOptions([
          { id: "option1", text: "请详细解释项目的核心功能" },
          { id: "option2", text: "这个项目的技术架构是什么?" },
          { id: "option3", text: "有哪些关键组件和它们的作用?" },
        ]);
      }
    } catch (error) {
      console.error("生成对话选项出错:", error);
      // 使用默认选项
      setDialogOptions([
        { id: "option1", text: "请详细解释项目的核心功能" },
        { id: "option2", text: "这个项目的技术架构是什么?" },
        { id: "option3", text: "有哪些关键组件和它们的作用?" },
      ]);
    }
  };

  // 处理选项点击
  const handleOptionClick = (option: DialogOption) => {
    continueConversation(option.text);
  };

  // 处理自定义输入提交
  const handleCustomInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      continueConversation(customInput.trim());
    }
  };

  // 终止对话
  const handleTerminate = () => {
    setIsComplete(true);
    onClose();
  };

  // 复制当前轮次的AI响应
  const copyCurrentResponse = () => {
    const currentResponse = responseSegments[currentRound];
    if (currentResponse) {
      navigator.clipboard.writeText(currentResponse);
      // 可以添加一个复制成功的提示
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 w-full h-full flex flex-col">
        {/* 对话框标题栏 - 更现代的设计 */}
        <div className="bg-white dark:bg-gray-800 px-4 sm:px-6 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
            AI 对话
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyCurrentResponse}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="复制当前响应"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
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
        </div>

        {/* 对话内容区域 - ChatGPT风格 */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-gray-50 dark:bg-gray-900"
        >
          {dialogRounds.length > 0 ? (
            <div className="max-w-3xl mx-auto w-full">
              {/* 渲染所有完成的对话轮次 */}
              {dialogRounds.map(renderDialogRound)}

              {/* 如果正在索引文件，显示索引中状态 */}
              {isIndexing && (
                <div className="flex items-center justify-center p-4 mb-4">
                  <div className="animate-spin mr-3">
                    <svg
                      className="w-5 h-5 text-blue-500"
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
                  </div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    正在索引相关文件...
                  </span>
                </div>
              )}

              {/* 如果已完成所有轮次，显示完成信息 */}
              {isComplete && (
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mt-4">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    测试已完成所有对话轮次，测试完毕。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400 text-center">
                <div className="animate-spin mb-4 mx-auto">
                  <svg
                    className="w-10 h-10 text-blue-500"
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
                </div>
                <p>{t("vectorReport.testingPrompt")}</p>
              </div>
            </div>
          )}
        </div>

        {/* 底部输入区域 - ChatGPT风格 */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleCustomInputSubmit} className="relative">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={isTesting ? "AI正在思考中..." : "输入您的问题..."}
                disabled={isTesting || isComplete}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
              />

              <div className="absolute right-2 top-1.5 sm:top-2 flex space-x-1">
                {!isTesting && !isComplete && (
                  <button
                    type="button"
                    onClick={() => setShowOptions(!showOptions)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                    title="显示建议问题"
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
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!customInput.trim() || isTesting || isComplete}
                  className={`p-1.5 rounded-md ${
                    !customInput.trim() || isTesting || isComplete
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  }`}
                  title="发送"
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
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </form>

            {/* 对话选项卡片 */}
            {showOptions && dialogOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{
                  duration: 0.2,
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
                className="mt-3 bg-white dark:bg-gray-750 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-2 flex flex-col gap-1 max-h-64 overflow-y-auto">
                  {dialogOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      onClick={() => handleOptionClick(option)}
                      className="px-3 py-2 text-left text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors break-words"
                      whileHover={optionHoverStyle}
                      whileTap={{ scale: 0.98 }}
                    >
                      {option.text}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 轮次信息和终止按钮 */}
            <div className="flex justify-between items-center mt-2 sm:mt-3 text-xs text-gray-500 dark:text-gray-400">
              <div>
                {currentRound > 0
                  ? t("vectorReport.aiDialog.round", {
                      current: String(currentRound),
                      max: String(maxRounds),
                    })
                  : t("vectorReport.aiDialog.initializing")}
              </div>
              <button
                onClick={handleTerminate}
                className="px-2 py-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline"
              >
                终止对话
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
