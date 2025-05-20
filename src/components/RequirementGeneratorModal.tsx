"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { useTheme } from "next-themes";

interface RequirementGeneratorModalProps {
  context: string;
  onClose: () => void;
}

export default function RequirementGeneratorModal({
  context,
  onClose,
}: RequirementGeneratorModalProps) {
  const { t, locale } = useTranslations();
  const { resolvedTheme } = useTheme();
  const [requirement, setRequirement] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 生成需求
    generateRequirement();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current && isGenerating) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [requirement, isGenerating]);

  const generateRequirement = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setRequirement("");
    setError("");

    try {
      // 构建提示词，根据当前语言设置调整
      const promptLanguage = locale === "zh" ? "Chinese" : "English";

      const prompt = `
Based on the following conversation, please generate a clear, specific requirement description. This requirement should:
1. Be written in the first person from the user's perspective ("I need...", "I want..." etc.)
2. Clearly describe functional requirements, technical requirements, and expected results
3. Be structured for easy understanding by developers
4. Avoid overly complex technical terms, keeping it concise and clear
5. Be suitable for direct pasting into code assistant tools (such as Cursor, GitHub Copilot, etc.)
6. Be written in ${promptLanguage}

Conversation content:
${context}

Please start directly with "My requirement is:" or the equivalent in ${promptLanguage}, without adding any prefix explanation or introduction.
`;

      // 调用API获取流式响应
      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "",
          messages: [
            {
              role: "system",
              content: `You are a professional requirements analyst who specializes in converting conversation content into structured development requirements. Please respond in ${promptLanguage}.`,
            },
            { role: "user", content: prompt },
          ],
          stream: true,
          referrer: "FoldaScan",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法获取响应流");

      // 用于解析SSE数据的函数
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码当前块
        buffer += decoder.decode(value, { stream: true });

        // 处理SSE数据
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(5).trim();
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                setRequirement((prev) => prev + content);
              }
            } catch (e) {
              console.error("解析SSE数据出错:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("生成需求出错:", error);
      setError(t("requirementGenerator.error"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(requirement);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-green-500"
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
            {t("requirementGenerator.title")}
          </h2>
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

        {/* 内容区域 */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : isGenerating ? (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {t("requirementGenerator.generating")}
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                  {requirement}
                  <motion.span
                    className="inline-block w-1.5 h-4 bg-green-500 dark:bg-green-400 rounded-sm ml-1"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  ></motion.span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {t("requirementGenerator.generated")}
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                  {requirement}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮区域 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("requirementGenerator.footer")}
          </div>
          <div className="flex space-x-3">
            <motion.button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={isGenerating}
            >
              {t("requirementGenerator.close")}
            </motion.button>
            <motion.button
              onClick={handleCopy}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={isGenerating || !requirement}
            >
              {isCopied ? (
                <>
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
                  {t("requirementGenerator.copied")}
                </>
              ) : (
                <>
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
                  {t("requirementGenerator.copy")}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
