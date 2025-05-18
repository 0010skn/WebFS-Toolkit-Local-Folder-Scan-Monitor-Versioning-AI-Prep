"use client";

import { useState, useEffect, useRef } from "react";
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

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden my-2">
      <div className="bg-gray-200 dark:bg-gray-600 px-4 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
        <span>{language || "code"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(children || "");
          }}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
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
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={isDark ? vscDarkPlus : vs}
        customStyle={{ margin: 0, padding: "1rem", fontSize: "0.875rem" }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
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
    <div className="my-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
      <div className="bg-blue-600 dark:bg-blue-800 text-white px-4 py-2 font-medium flex items-center justify-between">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>工具调用: {title}</span>
        </div>
        <span className="text-xs opacity-70">AI模拟</span>
      </div>
      <div className="p-4">
        {params && (
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              参数:
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2 text-sm">
              {params.split("\n").map((param, k) => (
                <div
                  key={k}
                  className="font-mono text-xs text-gray-700 dark:text-gray-300"
                >
                  {param}
                </div>
              ))}
            </div>
          </div>
        )}
        {result && (
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              结果:
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2 text-sm">
              {result.split("\n").map((line, k) => (
                <div
                  key={k}
                  className="font-mono text-xs text-gray-700 dark:text-gray-300"
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

// 修改FileIndexCard组件以接受data属性
const FileIndexCard = ({ data }: { data?: string }) => {
  // 解析传入的数据
  let files: string[] = [];
  try {
    if (data) {
      const parsed = JSON.parse(decodeURIComponent(data));
      if (Array.isArray(parsed)) {
        files = parsed;
      }
    }
  } catch (error) {
    console.error("解析文件索引数据出错:", error);
  }

  return (
    <div className="my-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
      <div className="bg-purple-600 dark:bg-purple-800 text-white px-4 py-2 font-medium flex items-center justify-between">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
          <span>文件索引更新</span>
        </div>
        <span className="text-xs opacity-70">自动索引</span>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          已为您自动索引以下相关文件:
        </div>
        <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2 max-h-40 overflow-y-auto">
          {files.length > 0 ? (
            files.map((file: string, index: number) => (
              <div
                key={index}
                className="font-mono text-xs text-gray-700 dark:text-gray-300 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0"
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
  // 定义对话轮次类型
  interface DialogRound {
    userInput: string;
    aiResponse: string;
    files?: string[];
    responseFiles?: string[];
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

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [dialogRounds, currentResponse]);

  // 开始测试
  useEffect(() => {
    if (initialPrompt) {
      startTest();
    }
  }, [initialPrompt]);

  // 开始测试
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

    try {
      // 获取项目文件路径列表
      const paths = filePaths.length > 0 ? filePaths : [];

      // 查找相关文件
      const jsonResult = await findRelevantFiles(initialPrompt, paths);
      const parsedResult = parseFilePathsResult(jsonResult);
      setIndexedFiles(parsedResult.relevant_paths);

      // 创建第一轮对话对象
      const firstRound: DialogRound = {
        userInput: initialPrompt,
        aiResponse: "",
        files:
          parsedResult.relevant_paths.length > 0
            ? parsedResult.relevant_paths
            : undefined,
      };

      // 只进行第一轮对话，后续轮次由用户选择
      let response = "";
      await testWithAI(
        initialPrompt,
        (chunk) => {
          // 更新最后一个字符用于动画
          setLastChar(chunk);
          // 更新动画键以触发新动画
          setAnimationKey((prev) => prev + 1);
          // 累积响应到当前响应
          setCurrentResponse((prev) => prev + chunk);
          response += chunk;
        },
        true // 只进行第一轮
      );

      // 更新第一轮对话的AI响应
      firstRound.aiResponse = response;
      setCurrentRound(1);
      setCurrentResponse("");

      // 保存第一轮响应
      setResponseSegments((prev) => ({ ...prev, 1: response }));

      // 第一轮对话结束后，根据AI响应重新生成文件索引
      try {
        const newJsonResult = await findRelevantFiles(response, paths);
        const newParsedResult = parseFilePathsResult(newJsonResult);
        const responseIndexedFiles = newParsedResult.relevant_paths;

        // 如果找到了新的相关文件，更新索引
        if (responseIndexedFiles.length > 0) {
          setIndexedFiles(responseIndexedFiles);
          firstRound.responseFiles = responseIndexedFiles;
        }
      } catch (indexError) {
        console.error("更新文件索引出错:", indexError);
      }

      // 添加第一轮对话到对话轮次数组
      setDialogRounds([firstRound]);

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

    // 创建新的对话轮次
    const newRound: DialogRound = {
      userInput: input,
      aiResponse: "",
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
      // 查找相关文件
      const paths = filePaths.length > 0 ? filePaths : [];
      const jsonResult = await findRelevantFiles(input, paths);
      const parsedResult = parseFilePathsResult(jsonResult);
      const newIndexedFiles = parsedResult.relevant_paths;
      setIndexedFiles(newIndexedFiles);

      // 如果找到了相关文件，添加到当前轮次
      if (newIndexedFiles.length > 0) {
        newRound.files = newIndexedFiles;
      }

      // 构建系统提示
      const nextRound = currentRound + 1;
      const systemPrompt = `这是第${nextRound}/${maxRounds}轮对话。
我已经为您索引了与当前对话相关的文件: ${JSON.stringify(newIndexedFiles)}
请根据这些文件和对话历史提供分析，并在回复中包含至少一个工具调用卡片的模拟展示。${
        nextRound === maxRounds
          ? "这是最后一轮对话，请在回复结束时提醒用户测试完毕并做出总结。"
          : ""
      }`;

      // 调用API获取响应
      let response = "";
      await testWithAI(
        input,
        (chunk) => {
          // 更新最后一个字符用于动画
          setLastChar(chunk);
          // 更新动画键以触发新动画
          setAnimationKey((prev) => prev + 1);
          // 累积响应到当前响应
          setCurrentResponse((prev) => prev + chunk);
          response += chunk;
        },
        false, // 不是第一轮
        updatedHistory,
        systemPrompt
      );

      // 更新当前轮次的AI响应
      newRound.aiResponse = response;

      // 保存当前轮次响应
      setResponseSegments((prev) => ({ ...prev, [nextRound]: response }));

      // 更新对话历史和轮次
      setConversationHistory([
        ...updatedHistory,
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
          const newJsonResult = await findRelevantFiles(response, paths);
          const newParsedResult = parseFilePathsResult(newJsonResult);
          const responseIndexedFiles = newParsedResult.relevant_paths;

          // 如果找到了新的相关文件，更新索引
          if (responseIndexedFiles.length > 0) {
            setIndexedFiles(responseIndexedFiles);
            newRound.responseFiles = responseIndexedFiles;
          }
        } catch (indexError) {
          console.error("更新文件索引出错:", indexError);
        }

        // 生成新的对话选项
        generateDialogOptions(input, response);
        // 默认不显示选项
        setShowOptions(false);
      }

      // 添加新轮次到对话轮次数组
      setDialogRounds((prev) => [...prev, newRound]);
    } catch (error) {
      console.error("AI对话继续出错:", error);
      newRound.aiResponse = t("vectorReport.error");
      setDialogRounds((prev) => [...prev, newRound]);
    } finally {
      setIsTesting(false);
    }
  };

  // 渲染单个对话轮次
  const renderDialogRound = (round: DialogRound, index: number) => {
    return (
      <div
        key={`round-${index}`}
        className="mb-8 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/30 dark:to-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        {/* 用户输入 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 mb-4 rounded-md border-l-4 border-blue-500">
          <strong>用户:</strong> {round.userInput}
        </div>

        {/* 相关文件索引 */}
        {round.files && round.files.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">
              相关文件索引:
            </div>
            <FileIndexCard
              data={encodeURIComponent(JSON.stringify(round.files))}
            />
          </div>
        )}

        {/* AI响应 */}
        <div className="ai-response">
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
              },
            }}
          >
            {processMarkdown(round.aiResponse)}
          </Markdown>
        </div>

        {/* 响应后的文件索引 */}
        {round.responseFiles && round.responseFiles.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">
              根据AI响应更新的文件索引:
            </div>
            <FileIndexCard
              data={encodeURIComponent(JSON.stringify(round.responseFiles))}
            />
          </div>
        )}
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
          const files = content
            .trim()
            .split("\n")
            .filter((f) => f.trim() !== "");
          return `<FileIndexCard data="${encodeURIComponent(
            JSON.stringify(files)
          )}" />`;
        } catch (error) {
          console.error("处理文件索引卡片出错:", error);
          return `<FileIndexCard data="${encodeURIComponent(
            JSON.stringify([])
          )}" />`;
        }
      }
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
        {/* 对话框标题栏 */}
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
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {t("vectorReport.testResult")}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyCurrentResponse}
              className="text-white hover:text-gray-200 focus:outline-none p-2 rounded-full hover:bg-blue-700"
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
              className="text-white hover:text-gray-200 focus:outline-none p-2 rounded-full hover:bg-blue-700"
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
        </div>

        {/* 对话内容区域 */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900"
        >
          {dialogRounds.length > 0 ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {/* 渲染所有完成的对话轮次 */}
              {dialogRounds.map(renderDialogRound)}

              {/* 如果当前有正在进行的响应，显示当前轮次 */}
              {currentResponse && (
                <div className="mb-8 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/30 dark:to-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="ai-response">
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
                        },
                      }}
                    >
                      {processMarkdown(currentResponse)}
                    </Markdown>
                    {lastChar && (
                      <motion.span
                        key={animationKey}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="animate-char text-blue-600 dark:text-blue-400 font-medium"
                      >
                        {lastChar}
                      </motion.span>
                    )}
                  </div>
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

        {/* 对话选项和输入区域 - 使用浮动面板而不是固定区域 */}
        <AnimatePresence>
          {!isTesting && !isComplete && currentRound > 0 && showOptions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-16 right-6 max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex justify-between items-center">
                    <span>{t("vectorReport.aiDialog.optionsTitle")}</span>
                    <button
                      onClick={() => setShowOptions(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {dialogOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleOptionClick(option)}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 text-blue-800 dark:text-blue-300 rounded-md text-sm transition-colors text-left"
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCustomInputSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={t(
                      "vectorReport.aiDialog.customInputPlaceholder"
                    )}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={!customInput.trim()}
                    className={`px-4 py-2 rounded-md text-white transition-colors ${
                      !customInput.trim()
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {t("vectorReport.aiDialog.send")}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部操作区 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-750 flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {currentRound > 0
              ? t("vectorReport.aiDialog.round", {
                  current: String(currentRound),
                  max: String(maxRounds),
                })
              : t("vectorReport.aiDialog.initializing")}
          </div>
          <div className="flex items-center space-x-2">
            {!showOptions && !isTesting && currentRound > 0 && !isComplete && (
              <button
                onClick={() => setShowOptions(true)}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 text-blue-800 dark:text-blue-300 rounded-md text-sm transition-colors"
              >
                显示选项
              </button>
            )}
            <button
              onClick={handleTerminate}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              {t("vectorReport.aiDialog.terminate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
