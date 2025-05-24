"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import {
  testWithAI,
  findRelevantFiles,
  parseFilePathsResult,
  getKnowledgeContent,
  chatCompletion,
  getLocalizedPrompt,
} from "../lib/vectorizeService";
import Markdown from "markdown-to-jsx";
// 引入SyntaxHighlighter的两种版本
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Light as LightSyntaxHighlighter } from "react-syntax-highlighter";
// 导入预设提示弹窗组件
import PresetPromptModal from "./PresetPromptModal";

// 导入Prism的样式
import {
  vscDarkPlus,
  materialDark,
  materialLight,
  okaidia,
  solarizedlight,
  prism,
} from "react-syntax-highlighter/dist/cjs/styles/prism";

// 导入highlight.js的样式
import {
  atomOneDark,
  atomOneLight,
  vs2015,
  github,
  monokai,
  vs,
  xcode,
  docco,
} from "react-syntax-highlighter/dist/cjs/styles/hljs";

// 导入语言支持
import javascript from "react-syntax-highlighter/dist/cjs/languages/hljs/javascript";
import typescript from "react-syntax-highlighter/dist/cjs/languages/hljs/typescript";
import python from "react-syntax-highlighter/dist/cjs/languages/hljs/python";
import java from "react-syntax-highlighter/dist/cjs/languages/hljs/java";
import jsx from "react-syntax-highlighter/dist/cjs/languages/hljs/xml";
import css from "react-syntax-highlighter/dist/cjs/languages/hljs/css";
import bash from "react-syntax-highlighter/dist/cjs/languages/hljs/bash";
import json from "react-syntax-highlighter/dist/cjs/languages/hljs/json";
import markdown from "react-syntax-highlighter/dist/cjs/languages/hljs/markdown";
import sql from "react-syntax-highlighter/dist/cjs/languages/hljs/sql";
import yaml from "react-syntax-highlighter/dist/cjs/languages/hljs/yaml";
import xml from "react-syntax-highlighter/dist/cjs/languages/hljs/xml";
import rust from "react-syntax-highlighter/dist/cjs/languages/hljs/rust";
import go from "react-syntax-highlighter/dist/cjs/languages/hljs/go";
import cpp from "react-syntax-highlighter/dist/cjs/languages/hljs/cpp";
import plaintext from "react-syntax-highlighter/dist/cjs/languages/hljs/plaintext";

// 注册语言
LightSyntaxHighlighter.registerLanguage("javascript", javascript);
LightSyntaxHighlighter.registerLanguage("typescript", typescript);
LightSyntaxHighlighter.registerLanguage("python", python);
LightSyntaxHighlighter.registerLanguage("java", java);
LightSyntaxHighlighter.registerLanguage("jsx", jsx);
LightSyntaxHighlighter.registerLanguage("tsx", typescript);
LightSyntaxHighlighter.registerLanguage("css", css);
LightSyntaxHighlighter.registerLanguage("bash", bash);
LightSyntaxHighlighter.registerLanguage("json", json);
LightSyntaxHighlighter.registerLanguage("markdown", markdown);
LightSyntaxHighlighter.registerLanguage("sql", sql);
LightSyntaxHighlighter.registerLanguage("yaml", yaml);
LightSyntaxHighlighter.registerLanguage("xml", xml);
LightSyntaxHighlighter.registerLanguage("rust", rust);
LightSyntaxHighlighter.registerLanguage("go", go);
LightSyntaxHighlighter.registerLanguage("cpp", cpp);
LightSyntaxHighlighter.registerLanguage("text", plaintext);
LightSyntaxHighlighter.registerLanguage("plaintext", plaintext);

import { useTheme } from "next-themes";
import { useAtom } from "jotai";
import { currentScanAtom } from "../lib/store";
import { KnowledgeEntry } from "../lib/knowledgeService";
import { FileSystemEntry } from "../types";
import RequirementGeneratorModal from "@/components/RequirementGeneratorModal";

// 创建一个增强版的Atom One Light主题
const createEnhancedAtomOneLight = () => {
  // 深拷贝atomOneLight主题
  const enhancedTheme = JSON.parse(JSON.stringify(atomOneLight));

  // 设置基本文本颜色
  if (enhancedTheme.hljs) {
    enhancedTheme.hljs.color = "#383a42";
  }

  // 设置各种语法元素的颜色
  const colorMapping = {
    "hljs-comment": "#a0a1a7",
    "hljs-quote": "#a0a1a7",
    "hljs-doctag": "#a626a4",
    "hljs-keyword": "#a626a4",
    "hljs-formula": "#a626a4",
    "hljs-section": "#e45649",
    "hljs-name": "#e45649",
    "hljs-selector-tag": "#e45649",
    "hljs-deletion": "#e45649",
    "hljs-subst": "#e45649",
    "hljs-literal": "#0184bb",
    "hljs-string": "#50a14f",
    "hljs-regexp": "#50a14f",
    "hljs-addition": "#50a14f",
    "hljs-attribute": "#50a14f",
    "hljs-meta-string": "#50a14f",
    "hljs-built_in": "#c18401",
    "hljs-class .hljs-title": "#c18401",
    "hljs-attr": "#986801",
    "hljs-variable": "#e45649",
    "hljs-template-variable": "#e45649",
    "hljs-type": "#986801",

    "hljs-selector-class": "#986801",
    "hljs-selector-attr": "#986801",
    "hljs-selector-pseudo": "#986801",
    "hljs-number": "#986801",
    "hljs-symbol": "#4078f2",
    "hljs-bullet": "#4078f2",
    "hljs-link": "#4078f2",
    "hljs-meta": "#4078f2",
    "hljs-selector-id": "#4078f2",
    "hljs-title": "#4078f2",
    "hljs-emphasis": { fontStyle: "italic" },
    "hljs-strong": { fontWeight: "bold" },
  };

  // 应用颜色映射到主题
  Object.entries(colorMapping).forEach(([key, color]) => {
    if (typeof color === "string") {
      if (!enhancedTheme[key]) enhancedTheme[key] = {};
      enhancedTheme[key].color = color;
    } else if (typeof color === "object") {
      if (!enhancedTheme[key]) enhancedTheme[key] = {};
      Object.assign(enhancedTheme[key], color);
    }
  });

  return enhancedTheme;
};

// 创建增强版Atom One Light主题
const enhancedAtomOneLight = createEnhancedAtomOneLight();

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
  // 从className中提取语言信息
  let language = className ? className.replace(/language-/, "") : "";

  // 如果语言是text或未指定，尝试自动检测语言
  if (!language || language === "text" || language === "plaintext") {
    language = detectCodeLanguage(children);
  }

  const [copied, setCopied] = useState(false);

  // 如果是单行代码，不做特殊处理
  const isSingleLine = !children.includes("\n") && children.trim().length < 50;
  if (isSingleLine) {
    return <code className="text-sm">{children}</code>;
  }

  // 复制代码功能
  const handleCopy = () => {
    navigator.clipboard.writeText(children || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 使用修改后的高亮样式
  const highlightStyle = isDark ? atomOneDark : atomOneLight;

  // 根据语言确定使用哪种高亮器
  const needsPrism = ["jsx", "tsx", "regex"].includes(language);
  const HighlighterComponent = needsPrism
    ? SyntaxHighlighter
    : LightSyntaxHighlighter;
  const styleToUse = needsPrism
    ? isDark
      ? vscDarkPlus
      : prism
    : highlightStyle;

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden my-2 w-full max-w-full syntax-highlighter-container">
      <div className="bg-gray-200 dark:bg-gray-600 px-4 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between sticky top-0 z-10">
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
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-md flex items-center transition-colors"
        >
          {copied ? (
            <span className="text-green-500 dark:text-green-400 flex items-center">
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
            </span>
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
        </button>
      </div>
      <div className="relative overflow-hidden w-full">
        <div
          className="overflow-x-auto w-full code-scroll-container"
          style={{ WebkitOverflowScrolling: "touch", maxWidth: "100%" }}
        >
          <HighlighterComponent
            language={language || "text"}
            style={styleToUse}
            customStyle={{
              margin: 0,
              padding: "1.25rem",
              fontSize: "14px",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              lineHeight: 1.6,
              background: isDark ? "#282c34" : "#fafafa",
              color: isDark ? "#abb2bf !important" : "#383a42 !important",
              maxWidth: "none",
              borderRadius: 0,
              overflowX: "auto",
              width: "max-content",
              minWidth: "100%",
            }}
            codeTagProps={{
              style: {
                fontSize: "14px",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                lineHeight: 1.6,
                color: isDark ? "#abb2bf !important" : "#383a42 !important",
              },
            }}
            preTagProps={{
              style: {
                margin: 0,
                padding: 0,
                backgroundColor: "transparent",
                color: isDark ? "#abb2bf !important" : "#383a42 !important",
              },
            }}
            showLineNumbers={
              language !== "text" &&
              language !== "" &&
              children.split("\n").length > 1
            }
            lineNumberStyle={{
              minWidth: "3em",
              paddingRight: "1em",
              color: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)",
              borderRight: isDark
                ? "1px solid rgba(255, 255, 255, 0.15)"
                : "1px solid rgba(0, 0, 0, 0.15)",
              marginRight: "1em",
              userSelect: "none",
              textAlign: "right",
              fontSize: "13px",
              fontWeight: "normal",
            }}
          >
            {children}
          </HighlighterComponent>
        </div>
      </div>
    </div>
  );
};

// 自动检测代码语言的函数
const detectCodeLanguage = (code: string): string => {
  // 检查代码中的特征来判断语言
  if (/\bimport\s+React|\bfrom\s+['"]react['"]/i.test(code)) {
    return code.includes("tsx") || code.includes(":") ? "tsx" : "jsx";
  }
  if (
    /\bimport\s+|\bexport\s+|\bconst\s+\w+\s*=\s*|let\s+\w+\s*=\s*/i.test(code)
  ) {
    return code.includes(":") ||
      code.includes("interface") ||
      code.includes("type ")
      ? "typescript"
      : "javascript";
  }
  if (/^(<!DOCTYPE|<html|<head|<body)/i.test(code)) {
    return "html";
  }
  if (/class=".*?"|className=".*?"|<div|<span|<p>/i.test(code)) {
    return "jsx";
  }
  if (/^\s*\.[\w-]+\s*{|@media|@keyframes/i.test(code)) {
    return "css";
  }
  if (/SELECT|INSERT|UPDATE|DELETE|CREATE TABLE/i.test(code)) {
    return "sql";
  }
  if (/def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import/i.test(code)) {
    return "python";
  }
  if (/public\s+(static\s+)?(void|class|int|boolean)/i.test(code)) {
    return "java";
  }
  if (/^\s*package\s+\w+|func\s+\w+\s*\(/i.test(code)) {
    return "go";
  }
  if (/^#include\s+<|std::|int\s+main\s*\(\s*\)/i.test(code)) {
    return "cpp";
  }
  if (
    /\$\w+\s*=|\$\w+\s*->|function\s+\w+\s*\(/i.test(code) &&
    code.includes("<?php")
  ) {
    return "php";
  }
  if (/^\s*{\s*["']\w+["']\s*:/i.test(code)) {
    return "json";
  }
  if (/npm|yarn|apt-get|sudo|bash|sh\s+/i.test(code)) {
    return "bash";
  }
  if (/^#!\/bin\/bash|^#!\/bin\/sh/i.test(code)) {
    return "bash";
  }
  if (/^\s*#\s+|^##\s+|^\*\*\s+/i.test(code)) {
    return "markdown";
  }

  // 检查文件扩展名引用
  const extMatch = code.match(/\.([a-zA-Z0-9]+)(\s|$|['")\]}]|:|,)/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    switch (ext) {
      case "js":
        return "javascript";
      case "jsx":
        return "jsx";
      case "ts":
        return "typescript";
      case "tsx":
        return "tsx";
      case "py":
        return "python";
      case "rb":
        return "ruby";
      case "java":
        return "java";
      case "php":
        return "php";
      case "go":
        return "go";
      case "cs":
        return "csharp";
      case "html":
        return "html";
      case "css":
        return "css";
      case "scss":
        return "scss";
      case "less":
        return "less";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "xml":
        return "xml";
      case "yml":
      case "yaml":
        return "yaml";
      case "sh":
        return "bash";
      case "sql":
        return "sql";
    }
  }

  return "text";
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
  const [functionMap, setFunctionMap] = useState<{ [key: string]: string[] }>(
    {}
  );

  useEffect(() => {
    // 在组件挂载后安全地解析数据
    try {
      if (data) {
        const decoded = decodeURIComponent(data);
        const parsed = JSON.parse(decoded);

        if (Array.isArray(parsed)) {
          // 如果已经是数组，直接使用
          const fileList = parsed.filter((item) => typeof item === "string");

          // 提取文件路径和函数信息
          const functionsObj: { [key: string]: string[] } = {};
          const cleanPaths: string[] = [];

          fileList.forEach((filePath) => {
            // 检查文件路径是否包含函数信息 "filepath (function:name[lines], ...)"
            const match = filePath.match(/^(.+?)\s+\((.+)\)$/);
            if (match) {
              const path = match[1];
              const functionStr = match[2];
              const functions = functionStr.split(", ");
              functionsObj[path] = functions;
              cleanPaths.push(path);
            } else {
              cleanPaths.push(filePath);
            }
          });

          setFiles(cleanPaths);
          setFunctionMap(functionsObj);
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
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="pb-2 last:pb-0">
                  <div className="font-mono text-xs text-gray-700 dark:text-gray-300 py-0.5 border-b border-gray-100 dark:border-gray-800 whitespace-pre-wrap break-words font-semibold">
                    {file}
                  </div>

                  {/* 显示函数和方法信息 */}
                  {functionMap[file] && functionMap[file].length > 0 && (
                    <div className="pl-4 mt-1 space-y-0.5">
                      {functionMap[file].map((func, funcIndex) => (
                        <div
                          key={funcIndex}
                          className="text-xs text-gray-600 dark:text-gray-400 font-mono"
                        >
                          {func}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
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

// 添加或修改样式部分，可以放在组件的样式区域
const tooltipStyles = `
.keyword-tooltip {
  position: fixed;
  z-index: 1000;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1rem;
  max-width: 90vw;
  max-height: 70vh;
  overflow-y: auto;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.dark .keyword-tooltip {
  background-color: rgba(31, 41, 55, 0.95);
  backdrop-filter: blur(8px);
  border-color: #374151;
  color: #f3f4f6;
}

.keyword-tooltip-content {
  position: relative;
  background-color: transparent;
}

.keyword-tooltip code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 0.1rem 0.2rem;
  border-radius: 0.25rem;
}

.dark .keyword-tooltip code {
  background-color: #374151;
}

.keyword-tooltip .line-number {
  color: #6b7280;
  user-select: none;
}

.dark .keyword-tooltip .line-number {
  color: #9ca3af;
}

.keyword-tooltip .highlight {
  background-color: rgba(252, 211, 77, 0.2);
  font-weight: 600;
}

.dark .keyword-tooltip .highlight {
  background-color: rgba(252, 211, 77, 0.15);
}

.top-arrow, .bottom-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
}

.top-arrow {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom: 8px solid #e2e8f0;
}

.dark .top-arrow {
  border-bottom-color: #374151;
}

.bottom-arrow {
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-top: 8px solid #e2e8f0;
}

.dark .bottom-arrow {
  border-top-color: #374151;
}

/* 优化语法高亮CSS */

.hljs-tag,
.hljs-name,
.hljs-attribute {
  color: #e06c75 !important;
}

.hljs-built_in {
  color: #e6c07b !important;
}

.hljs-string {
  color: #98c379 !important;
}

.hljs-number {
  color: #d19a66 !important;
}

.hljs-comment {
  color: #7f848e !important;
  font-style: italic;
}

.hljs-keyword {
  color: #c678dd !important;
}

.hljs-selector-tag {
  color: #e06c75 !important;
}

.hljs-literal {
  color: #56b6c2 !important;
}

.hljs-title {
  color: #61afef !important;
}

.hljs-section {
  color: #e06c75 !important;
}

.hljs-doctag {
  color: #c678dd !important;
}

.hljs-type {
  color: #e6c07b !important;
}

.hljs-attr {
  color: #d19a66 !important;
}

.hljs-symbol {
  color: #56b6c2 !important;
}

.hljs-bullet {
  color: #56b6c2 !important;
}

.hljs-link {
  color: #c678dd !important;
  text-decoration: underline;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}

/* 修复浅色模式下文本颜色 */
.hljs-custom-container {
  color: #383a42 !important; /* 浅色模式下默认文本颜色 */
}

.dark .hljs-custom-container {
  color: #abb2bf !important; /* 深色模式下默认文本颜色 */
}

/* 确保所有默认文本在浅色模式下显示为深色 */
.syntax-highlighter-container code,
.syntax-highlighter-container pre {
  color: #383a42 !important;
}

.dark .syntax-highlighter-container code,
.dark .syntax-highlighter-container pre {
  color: #abb2bf !important;
}

/* 修复所有内联元素的默认颜色 */
.syntax-highlighter-container span:not([class]) {
  color: #383a42 !important;
}

.dark .syntax-highlighter-container span:not([class]) {
  color: #abb2bf !important;
}

/* 添加样式修复atomOneLight主题的问题 */
.hljs.atomOneLight {
  color: #383a42 !important;
}

.hljs.atomOneLight .hljs-subst,
.hljs.atomOneLight .hljs-variable,
.hljs.atomOneLight .hljs-template-variable,
.hljs.atomOneLight .hljs-tag,
.hljs.atomOneLight .hljs-name,
.hljs.atomOneLight .hljs-selector-id,
.hljs.atomOneLight .hljs-selector-class,
.hljs.atomOneLight .hljs-regexp,
.hljs.atomOneLight .hljs-deletion {
  color: #383a42 !important;
}

/* 对Light组件的特殊处理 */
.light-syntax-highlighter span {
  color: #383a42 !important;
}

.code-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.code-scroll-container::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}

.code-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.code-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.dark .code-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.hljs-custom-container {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
}

.hljs-custom-container span {
  background: transparent !important;
}

/* 移动设备优化 */
@media (max-width: 640px) {
  .syntax-highlighter-container {
    width: calc(100% + 2rem) !important;
    margin-left: -1rem !important;
    margin-right: -1rem !important;
    border-radius: 0 !important;
  }

  .code-scroll-container pre {
    max-width: 100% !important;
  }
}
`;

export default function AITestDialog({
  onClose,
  initialPrompt,
  projectFilePaths = [],
}: AITestDialogProps) {
  // 添加样式到head
  useEffect(() => {
    // 创建样式元素
    const styleEl = document.createElement("style");
    styleEl.textContent = tooltipStyles;
    document.head.appendChild(styleEl);

    // 添加代码高亮修复样式
    const codeHighlightStyle = document.createElement("style");
    codeHighlightStyle.textContent = `
      /* 修复代码块字体大小和高亮 */
      .syntax-highlighter-container {
        font-size: 14px !important;
      }

      .syntax-highlighter-container code,
      .syntax-highlighter-container pre {
        font-size: 14px !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
        line-height: 1.6 !important;
      }

      /* 浅色模式下的基础文本颜色 */
      .syntax-highlighter-container,
      .syntax-highlighter-container code,
      .syntax-highlighter-container pre {
        color: #383a42 !important;
      }

      /* 深色模式下的基础文本颜色 */
      .dark .syntax-highlighter-container,
      .dark .syntax-highlighter-container code,
      .dark .syntax-highlighter-container pre {
        color: #abb2bf !important;
      }

      /* 浅色模式下的语法高亮 - 使用Atom One Light主题 */
      .syntax-highlighter-container .hljs-keyword { color: #a626a4 !important; }
      .syntax-highlighter-container .hljs-built_in { color: #c18401 !important; }
      .syntax-highlighter-container .hljs-string { color: #50a14f !important; }
      .syntax-highlighter-container .hljs-number { color: #986801 !important; }
      .syntax-highlighter-container .hljs-comment { color: #a0a1a7 !important; font-style: italic !important; }
      .syntax-highlighter-container .hljs-title { color: #4078f2 !important; }
      .syntax-highlighter-container .hljs-attr { color: #986801 !important; }
      .syntax-highlighter-container .hljs-tag { color: #e45649 !important; }
      .syntax-highlighter-container .hljs-name { color: #e45649 !important; }
      .syntax-highlighter-container .hljs-type { color: #986801 !important; }
      .syntax-highlighter-container .hljs-variable { color: #e45649 !important; }
      .syntax-highlighter-container .hljs-function { color: #4078f2 !important; }
      .syntax-highlighter-container .hljs-params { color: #383a42 !important; }
      .syntax-highlighter-container .hljs-literal { color: #0184bc !important; }
      .syntax-highlighter-container .hljs-selector-tag { color: #e45649 !important; }
      .syntax-highlighter-container .hljs-selector-class { color: #c18401 !important; }
      .syntax-highlighter-container .hljs-selector-id { color: #4078f2 !important; }
      .syntax-highlighter-container .hljs-property { color: #383a42 !important; }
      .syntax-highlighter-container .hljs-value { color: #50a14f !important; }
      .syntax-highlighter-container .hljs-class { color: #c18401 !important; }
      .syntax-highlighter-container .hljs-doctag { color: #a626a4 !important; }
      .syntax-highlighter-container .hljs-meta { color: #e45649 !important; }
      .syntax-highlighter-container .hljs-meta-keyword { color: #a626a4 !important; }
      .syntax-highlighter-container .hljs-meta-string { color: #50a14f !important; }

      /* 深色模式下的语法高亮 - 使用Atom One Dark主题 */
      .dark .syntax-highlighter-container .hljs-keyword { color: #c678dd !important; }
      .dark .syntax-highlighter-container .hljs-built_in { color: #e6c07b !important; }
      .dark .syntax-highlighter-container .hljs-string { color: #98c379 !important; }
      .dark .syntax-highlighter-container .hljs-number { color: #d19a66 !important; }
      .dark .syntax-highlighter-container .hljs-comment { color: #7f848e !important; font-style: italic !important; }
      .dark .syntax-highlighter-container .hljs-title { color: #61afef !important; }
      .dark .syntax-highlighter-container .hljs-attr { color: #d19a66 !important; }
      .dark .syntax-highlighter-container .hljs-tag { color: #e06c75 !important; }
      .dark .syntax-highlighter-container .hljs-name { color: #e06c75 !important; }
      .dark .syntax-highlighter-container .hljs-type { color: #e6c07b !important; }
      .dark .syntax-highlighter-container .hljs-variable { color: #e06c75 !important; }
      .dark .syntax-highlighter-container .hljs-function { color: #61afef !important; }
      .dark .syntax-highlighter-container .hljs-params { color: #abb2bf !important; }
      .dark .syntax-highlighter-container .hljs-literal { color: #56b6c2 !important; }
      .dark .syntax-highlighter-container .hljs-selector-tag { color: #e06c75 !important; }
      .dark .syntax-highlighter-container .hljs-selector-class { color: #e6c07b !important; }
      .dark .syntax-highlighter-container .hljs-selector-id { color: #61afef !important; }
      .dark .syntax-highlighter-container .hljs-property { color: #abb2bf !important; }
      .dark .syntax-highlighter-container .hljs-value { color: #98c379 !important; }
      .dark .syntax-highlighter-container .hljs-class { color: #e6c07b !important; }
      .dark .syntax-highlighter-container .hljs-doctag { color: #c678dd !important; }
      .dark .syntax-highlighter-container .hljs-meta { color: #e06c75 !important; }
      .dark .syntax-highlighter-container .hljs-meta-keyword { color: #c678dd !important; }
      .dark .syntax-highlighter-container .hljs-meta-string { color: #98c379 !important; }

      /* 滚动条样式 */
      .code-scroll-container {
        scrollbar-width: thin;
        scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
      }

      .code-scroll-container::-webkit-scrollbar {
        height: 6px;
        width: 6px;
      }

      .code-scroll-container::-webkit-scrollbar-track {
        background: transparent;
      }

      .code-scroll-container::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 3px;
      }

      .dark .code-scroll-container::-webkit-scrollbar-thumb {
        background-color: rgba(75, 85, 99, 0.5);
      }

      /* 强制设置Python语法高亮 */
      .syntax-highlighter-container .token.decorator,
      .syntax-highlighter-container .token.at-rule,
      .syntax-highlighter-container .hljs-meta {
        color: #c678dd !important;
      }

      .dark .syntax-highlighter-container .token.decorator,
      .dark .syntax-highlighter-container .token.at-rule,
      .dark .syntax-highlighter-container .hljs-meta {
        color: #c678dd !important;
      }

      body:not(.dark) .syntax-highlighter-container .token.decorator,
      body:not(.dark) .syntax-highlighter-container .token.at-rule,
      body:not(.dark) .syntax-highlighter-container .hljs-meta {
        color: #a626a4 !important;
      }
    `;
    document.head.appendChild(codeHighlightStyle);

    // 清理函数
    return () => {
      document.head.removeChild(styleEl);
      document.head.removeChild(codeHighlightStyle);
    };
  }, []);
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
    knowledgeEntries?: string[]; // 知识库条目标题
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
  const maxRounds = 60;
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

  // 添加需求生成器相关状态
  const [showRequirementGenerator, setShowRequirementGenerator] =
    useState(false);
  const [requirementContext, setRequirementContext] = useState("");

  // 添加预设提示弹窗状态
  const [showPresetPrompts, setShowPresetPrompts] = useState(false);

  // 自动滚动到当前AI回复的开头位置（已禁用）
  const scrollToCurrentResponse = useCallback(() => {
    // 已禁用自动滚动功能，用户可以手动滚动查看内容
    // 原代码保留作为参考
    /*
    if (currentRoundRef.current) {
      currentRoundRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (contentRef.current) {
      // 如果找不到当前轮次的引用，则滚动到底部
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
    */
  }, [currentRoundRef]);

  // 监听AI回复完成，不再自动滚动（已禁用）
  useEffect(() => {
    // 已禁用自动滚动功能，用户可以手动滚动查看内容
    /*
    if (!isTesting && dialogRounds.length > 0 && currentRound > 0) {
      // AI回复完成时滚动到当前回复开头
      scrollToCurrentResponse();
    }
    */
  }, [isTesting, dialogRounds.length, currentRound, scrollToCurrentResponse]);

  // 处理关键字点击事件，获取关键字的上下文信息
  useEffect(() => {
    // 添加点击事件监听器
    const handleKeywordClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // 检查是否点击了关键字元素
      if (
        target &&
        target.classList.contains("text-blue-600") &&
        target.hasAttribute("data-keyword")
      ) {
        const keyword = target.getAttribute("data-keyword");
        const tooltipId = target.getAttribute("data-tooltip-id");

        if (keyword && tooltipId) {
          const tooltipElement = document.getElementById(tooltipId);

          if (tooltipElement) {
            // 获取元素位置
            const rect = target.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 检测是否为移动设备（宽度小于768px）
            const isMobile = viewportWidth < 768;

            // 固定气泡宽度
            const tooltipWidth = isMobile ? 300 : 280;

            // 计算最佳位置
            let tooltipX, tooltipY;
            let position = "top"; // 默认在上方

            if (isMobile) {
              // 在移动设备上，将气泡水平居中显示
              tooltipX = (viewportWidth - tooltipWidth) / 2;

              // 垂直位置：优先显示在屏幕中上部
              const idealY = Math.min(viewportHeight * 0.3, rect.top - 20);
              tooltipY = Math.max(10, idealY);
              position = "center"; // 在移动设备上始终使用中心位置样式
            } else {
              // 在桌面设备上，将气泡显示在元素附近
              tooltipX = rect.left;
              tooltipY = rect.top - 10;

              // 水平方向调整，确保不超出右侧边界
              if (tooltipX + tooltipWidth > viewportWidth) {
                tooltipX = Math.max(0, viewportWidth - tooltipWidth - 10);
              }

              // 垂直方向调整，如果上方空间不足，则显示在元素下方
              const tooltipHeight = 150; // 估计高度
              const spaceAbove = rect.top;
              const spaceBelow = viewportHeight - rect.bottom;

              if (spaceAbove < tooltipHeight && spaceBelow > spaceAbove) {
                // 如果上方空间不足且下方空间更多，则显示在下方
                tooltipY = rect.bottom + 10;
                position = "bottom";
              }
            }

            // 显示加载中的状态
            tooltipElement.innerHTML = `
              <div class="keyword-tooltip-content bg-transparent">
                <div class="text-sm flex items-center space-x-2">
                  <div class="animate-spin h-4 w-4 border-2 border-emerald-500 rounded-full border-t-transparent"></div>
                  <span>正在获取 "${keyword}" 的相关信息...</span>
                </div>
                ${
                  position !== "center"
                    ? `<div class="keyword-tooltip-arrow ${
                        position === "bottom" ? "top-arrow" : "bottom-arrow"
                      }"></div>`
                    : ""
                }
              </div>
            `;

            // 设置位置
            tooltipElement.style.left = `${tooltipX}px`;
            tooltipElement.style.top = `${tooltipY}px`;
            tooltipElement.style.transform =
              position === "top" ? "translateY(-100%)" : "translateY(0)";
            tooltipElement.style.display = "block";

            try {
              // 获取当前对话轮次的上下文
              const currentRoundData = dialogRounds[currentRound - 1];

              // 从conversationHistory获取完整的对话历史
              let contextInfo = "对话历史:\n";

              // 使用conversationHistory而不是dialogRounds，确保获取完整历史
              for (let i = 0; i < conversationHistory.length; i++) {
                const message = conversationHistory[i];
                if (message.role === "user") {
                  contextInfo += `用户: ${message.content.substring(0, 100)}${
                    message.content.length > 100 ? "..." : ""
                  }\n`;
                } else if (message.role === "assistant") {
                  contextInfo += `AI: ${message.content.substring(0, 100)}${
                    message.content.length > 100 ? "..." : ""
                  }\n`;
                }
              }

              // 添加索引的文件信息
              if (
                currentRoundData &&
                currentRoundData.files &&
                currentRoundData.files.length > 0
              ) {
                contextInfo += "\n相关文件:\n";
                currentRoundData.files.forEach((file) => {
                  contextInfo += `- ${file}\n`;
                });
              }

              // 添加知识库条目信息
              if (
                currentRoundData &&
                currentRoundData.knowledgeEntries &&
                currentRoundData.knowledgeEntries.length > 0
              ) {
                contextInfo += "\n相关知识库条目:\n";
                currentRoundData.knowledgeEntries.forEach((entry) => {
                  contextInfo += `- ${entry}\n`;
                });
              }

              // 确保上下文信息不为空
              if (
                contextInfo.trim() === "对话历史:" ||
                contextInfo.trim() === ""
              ) {
                contextInfo = "当前项目信息:\n";
                // 添加一些基本项目信息
                if (
                  currentScan &&
                  currentScan.entries &&
                  currentScan.entries.length > 0
                ) {
                  contextInfo += `- 项目包含 ${currentScan.entries.length} 个文件\n`;
                  // 添加一些主要文件类型
                  const fileTypes = new Set<string>();
                  currentScan.entries.forEach((entry) => {
                    if (entry.path) {
                      const ext = entry.path.split(".").pop()?.toLowerCase();
                      if (ext) fileTypes.add(ext);
                    }
                  });
                  if (fileTypes.size > 0) {
                    contextInfo += `- 主要文件类型: ${Array.from(
                      fileTypes
                    ).join(", ")}\n`;
                  }
                }
              }

              // 获取当前对话中的文件内容
              let fileContents = "";
              if (
                currentScan &&
                currentScan.entries &&
                currentScan.entries.length > 0
              ) {
                // 首先从当前轮次的相关文件中获取内容
                const relevantFiles = currentRoundData?.files || [];
                let matchFound = false;

                for (const file of relevantFiles) {
                  const entry = currentScan.entries.find(
                    (e) => e.path === file && e.type === "file"
                  );

                  if (entry && entry.content) {
                    // 检查关键词是否在文件内容中
                    if (entry.content.includes(keyword)) {
                      matchFound = true;
                      // 获取关键词附近的上下文，并增加行号
                      const lines = entry.content.split("\n");
                      const keywordLine = lines.findIndex((line) =>
                        line.includes(keyword)
                      );

                      if (keywordLine !== -1) {
                        // 提取关键词前后10行的内容，添加行号
                        const startLine = Math.max(0, keywordLine - 10);
                        const endLine = Math.min(
                          lines.length - 1,
                          keywordLine + 10
                        );
                        let keywordContext = "";

                        for (let i = startLine; i <= endLine; i++) {
                          const linePrefix = `${i + 1}| `;
                          const lineContent =
                            i === keywordLine
                              ? lines[i].replace(keyword, `**${keyword}**`) // 加粗关键词
                              : lines[i];
                          keywordContext += `${linePrefix}${lineContent}\n`;
                        }

                        // 查找该文件中包含关键词所在行的函数/方法
                        let functionContext = "";
                        if (
                          currentScan.codeStructure &&
                          currentScan.codeStructure.functions
                        ) {
                          const containingFunctions =
                            currentScan.codeStructure.functions.filter(
                              (func) =>
                                func.filePath === file &&
                                func.lines[0] <= keywordLine + 1 &&
                                func.lines[1] >= keywordLine + 1
                            );

                          if (containingFunctions.length > 0) {
                            functionContext = `\n关键词位于以下函数/方法中:\n`;
                            containingFunctions.forEach((func) => {
                              functionContext += `- ${func.type}: ${func.name} [行 ${func.lines[0]}-${func.lines[1]}]\n`;
                              // 添加函数调用关系
                              if (func.calls && func.calls.length > 0) {
                                functionContext += `  调用: ${func.calls.join(
                                  ", "
                                )}\n`;
                              }
                            });
                          }
                        }

                        fileContents = `文件: ${file} (关键词 "${keyword}" 出现在第 ${
                          keywordLine + 1
                        } 行)\n${functionContext}\n代码上下文:\n${keywordContext}\n\n`;
                      } else {
                        // 对于长文本，查找关键词的位置并提取周围内容
                        const keywordIndex = entry.content.indexOf(keyword);
                        const contextStart = Math.max(0, keywordIndex - 500);
                        const contextEnd = Math.min(
                          entry.content.length,
                          keywordIndex + keyword.length + 500
                        );
                        const keywordContext = entry.content.substring(
                          contextStart,
                          contextEnd
                        );

                        fileContents = `文件: ${file} (包含关键词 "${keyword}")\n内容:\n${keywordContext}\n\n`;
                      }
                      break; // 找到匹配后退出循环
                    } else {
                      // 如果没有找到关键词，就添加文件内容
                      const truncatedContent =
                        entry.content.length > 1000
                          ? entry.content.substring(0, 1000) + "..."
                          : entry.content;

                      fileContents += `文件: ${file}\n内容:\n${truncatedContent}\n\n`;
                    }
                  }
                }

                // 如果当前轮次的文件中没有找到关键词，则在整个项目中搜索
                if (!matchFound) {
                  // 检查关键词是否是一个函数/方法名
                  let foundFunction = false;
                  if (
                    currentScan.codeStructure &&
                    currentScan.codeStructure.functions
                  ) {
                    const functionsWithName =
                      currentScan.codeStructure.functions.filter(
                        (func) =>
                          func.name.includes(keyword) ||
                          keyword.includes(func.name)
                      );

                    if (functionsWithName.length > 0) {
                      foundFunction = true;
                      fileContents = `关键词 "${keyword}" 似乎是一个函数/方法名:\n\n`;

                      functionsWithName.forEach((func) => {
                        fileContents += `- ${func.type}: ${func.name} [在文件 ${func.filePath} 的第 ${func.lines[0]}-${func.lines[1]} 行]\n`;

                        // 添加函数调用关系
                        if (func.calls && func.calls.length > 0) {
                          fileContents += `  调用: ${func.calls.join(", ")}\n`;
                        }

                        // 尝试获取函数的源代码
                        const funcFile = currentScan.entries.find(
                          (e) => e.path === func.filePath && e.type === "file"
                        );
                        if (funcFile && funcFile.content) {
                          const lines = funcFile.content.split("\n");
                          // 获取函数源代码（行号范围从1开始，数组索引从0开始）
                          const functionCode = lines
                            .slice(func.lines[0] - 1, func.lines[1])
                            .join("\n");
                          fileContents += `\n源代码:\n${functionCode}\n\n`;
                        }
                      });
                    }
                  }

                  if (!foundFunction) {
                    // 在所有项目文件中搜索关键词
                    let mostRelevantFile: string | null = null;
                    let mostRelevantContent = "";
                    let mostRelevantLineNumber = -1;

                    // 搜索所有文件内容
                    for (const entry of currentScan.entries) {
                      if (
                        entry.type === "file" &&
                        entry.content &&
                        entry.content.includes(keyword)
                      ) {
                        mostRelevantFile = entry.path || null;
                        // 找出关键词所在行
                        const lines = entry.content.split("\n");
                        const keywordLine = lines.findIndex((line) =>
                          line.includes(keyword)
                        );

                        if (keywordLine !== -1) {
                          mostRelevantLineNumber = keywordLine + 1;
                          // 提取关键词前后10行的内容，添加行号
                          const startLine = Math.max(0, keywordLine - 10);
                          const endLine = Math.min(
                            lines.length - 1,
                            keywordLine + 10
                          );
                          let contextWithLines = "";

                          for (let i = startLine; i <= endLine; i++) {
                            const linePrefix = `${i + 1}| `;
                            const lineContent =
                              i === keywordLine
                                ? lines[i].replace(keyword, `**${keyword}**`)
                                : lines[i];
                            contextWithLines += `${linePrefix}${lineContent}\n`;
                          }

                          mostRelevantContent = contextWithLines;
                          break; // 找到一个匹配就退出
                        } else {
                          // 如果无法确定确切行，提取包含关键词的部分
                          const keywordIndex = entry.content.indexOf(keyword);
                          const contextStart = Math.max(0, keywordIndex - 300);
                          const contextEnd = Math.min(
                            entry.content.length,
                            keywordIndex + keyword.length + 300
                          );
                          mostRelevantContent = entry.content.substring(
                            contextStart,
                            contextEnd
                          );
                        }
                      }
                    }

                    if (mostRelevantFile) {
                      const lineInfo =
                        mostRelevantLineNumber > 0
                          ? `(关键词出现在第 ${mostRelevantLineNumber} 行)`
                          : "";
                      fileContents = `文件: ${mostRelevantFile} ${lineInfo}\n内容:\n${mostRelevantContent}\n\n`;

                      // 如果找到了关键词所在行，检查它是否在某个函数/方法内
                      if (
                        mostRelevantLineNumber > 0 &&
                        currentScan.codeStructure &&
                        currentScan.codeStructure.functions
                      ) {
                        const containingFunctions =
                          currentScan.codeStructure.functions.filter(
                            (func) =>
                              func.filePath === mostRelevantFile &&
                              func.lines[0] <= mostRelevantLineNumber &&
                              func.lines[1] >= mostRelevantLineNumber
                          );

                        if (containingFunctions.length > 0) {
                          fileContents += `关键词位于以下函数/方法中:\n`;
                          containingFunctions.forEach((func) => {
                            fileContents += `- ${func.type}: ${func.name} [行 ${func.lines[0]}-${func.lines[1]}]\n`;
                            if (func.calls && func.calls.length > 0) {
                              fileContents += `  调用: ${func.calls.join(
                                ", "
                              )}\n`;
                            }
                          });
                          fileContents += "\n";
                        }
                      }
                    } else {
                      // 如果找不到精确匹配，尝试模糊匹配
                      // 先尝试精确匹配文件名
                      if (keyword.includes(".") && keyword.length > 3) {
                        const exactFileMatch = currentScan.entries.find(
                          (e) =>
                            e.path &&
                            e.path.endsWith(keyword) &&
                            e.type === "file"
                        );

                        if (
                          exactFileMatch &&
                          exactFileMatch.content &&
                          exactFileMatch.path
                        ) {
                          mostRelevantFile = exactFileMatch.path;
                          // 显示文件的前30行，通常包含重要导入和声明
                          const lines = exactFileMatch.content
                            .split("\n")
                            .slice(0, 30);
                          mostRelevantContent = lines
                            .map((line, idx) => `${idx + 1}| ${line}`)
                            .join("\n");
                        }
                      }

                      if (mostRelevantFile) {
                        fileContents = `文件: ${mostRelevantFile} (文件名匹配关键词 "${keyword}")\n内容:\n${mostRelevantContent}\n\n`;
                      } else {
                        // 如果没有找到包含关键词的文件，使用最常见的文件类型
                        const commonFileTypes = [
                          ".ts",
                          ".tsx",
                          ".js",
                          ".jsx",
                          ".py",
                          ".go",
                          ".java",
                          ".c",
                          ".cpp",
                          ".md",
                        ];

                        for (const ext of commonFileTypes) {
                          // 查找最多3个具有此扩展名的文件
                          const filesWithExt = currentScan.entries
                            .filter(
                              (e) =>
                                e.type === "file" &&
                                e.path &&
                                e.path.endsWith(ext) &&
                                e.content
                            )
                            .slice(0, 3);

                          if (filesWithExt.length > 0) {
                            fileContents =
                              "在项目中未找到直接包含关键词的文件，展示一些相关文件作为上下文：\n\n";

                            for (const entry of filesWithExt) {
                              if (entry.path && entry.content) {
                                // 只显示文件的前15行（通常包含导入语句和主要定义）
                                const topLines = entry.content
                                  .split("\n")
                                  .slice(0, 15);
                                const formattedLines = topLines
                                  .map((line, idx) => `${idx + 1}| ${line}`)
                                  .join("\n");

                                fileContents += `文件: ${entry.path}\n内容(前15行):\n${formattedLines}\n\n`;
                              }
                            }

                            break; // 找到相关文件后退出循环
                          }
                        }
                      }
                    }
                  }
                }
              }

              // 如果没有任何文件内容，提供一个基本信息标记
              if (!fileContents || fileContents.trim() === "") {
                fileContents = `未在项目中找到与关键词"${keyword}"相关的文件内容。
以下是项目的基本信息作为参考：
- 项目类型: Web应用（Next.js）
- 主要技术栈: ${currentScan ? "TypeScript, React, Next.js" : "未知"}
- 文件总数: ${currentScan?.entries?.length || "未知"}
`;
              }

              // 调用AI获取关键字的上下文信息
              const response = await chatCompletion([
                {
                  role: "system",
                  content: getLocalizedPrompt(
                    `你是一个专业的解释助手。请根据提供的上下文信息和文件内容，简明扼要地解释用户询问的关键词或术语，重点关注其在当前项目的含义。回答限制在200字以内。

在回答时遵循以下规则：
1. 如果上下文中包含关于关键词的明确信息，优先使用这些信息进行解释
2. 对于文件名或模块名，解释其在项目中的功能和用途
3. 对于技术术语，解释其一般含义以及在当前项目中的特定应用
4. 如果缺乏具体信息，可以基于文件类型和项目上下文做出合理推测
5. 总是包括关键词在项目中的实际或可能的应用场景
6. 清晰、简洁地表达，使用技术准确的语言`,

                    `You are a professional explanation assistant. Based on the provided context information and file content, concisely explain the keyword or term the user is asking about, focusing on its meaning in the current project. Limit your answer to 200 characters.

Follow these rules when answering:
1. If the context contains explicit information about the keyword, prioritize using this information for explanation
2. For file names or module names, explain their function and purpose in the project
3. For technical terms, explain their general meaning and specific application in the current project
4. If specific information is lacking, make reasonable inferences based on file type and project context
5. Always include the actual or potential application scenarios of the keyword in the project
6. Express clearly and concisely, using technically accurate language`
                  ),
                },
                {
                  role: "user",
                  content: getLocalizedPrompt(
                    `基于以下上下文信息和文件内容，请解释"${keyword}"这个术语或概念在当前项目中的含义：

上下文信息:
${contextInfo}

文件内容:
${fileContents}

如果上下文中没有足够的信息，请基于你的技术知识，结合项目上下文做出最有可能的解释。例如：
- 如果这是一个文件名(如"import_to_supabase.py")，解释此文件可能的功能
- 如果这是一个技术术语(如"vectorization")，解释其在当前技术栈中的含义
- 如果这是一个框架组件(如"AITestDialog")，解释其用途和功能`,

                    `Based on the following context information and file content, please explain the meaning of the term or concept "${keyword}" in the current project:

Context information:
${contextInfo}

File content:
${fileContents}

If there is not enough information in the context, please make the most likely explanation based on your technical knowledge and the project context. For example:
- If this is a file name (like "import_to_supabase.py"), explain the possible function of this file
- If this is a technical term (like "vectorization"), explain its meaning in the current technology stack
- If this is a framework component (like "AITestDialog"), explain its purpose and functionality`
                  ),
                },
              ]);
              console.log(`基于以下上下文信息和文件内容，请解释"${keyword}"这个术语或概念在当前项目中的含义：

上下文信息:
${contextInfo}

文件内容:
${fileContents}`);
              const explanation = response.choices[0].message.content;

              // 确保markdown风格的加粗符号会被正确渲染为HTML
              const formattedExplanation = explanation
                .replace(
                  /\*\*([^*]+)\*\*/g,
                  '<span class="font-bold text-emerald-600">$1</span>'
                )
                .replace(
                  /`([^`]+)`/g,
                  '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">$1</code>'
                )
                .replace(/\n/g, "<br>")
                .replace(/(\d+\|)/g, '<span class="text-gray-500">$1</span>');
              tooltipElement.innerHTML = `
                <div class="text-sm whitespace-pre-wrap text-left font-mono">${formattedExplanation}</div>
                ${
                  position !== "center"
                    ? `<div class="keyword-tooltip-arrow ${
                        position === "bottom" ? "top-arrow" : "bottom-arrow"
                      }"></div>`
                    : ""
                }
              `;
            } catch (error) {
              console.error("获取关键字信息出错:", error);
              tooltipElement.innerHTML = `
                <div class="keyword-tooltip-content bg-transparent">
                  <div class="text-sm text-red-500 whitespace-pre-wrap">获取信息失败，请重试</div>
                  ${
                    position !== "center"
                      ? `<div class="keyword-tooltip-arrow ${
                          position === "bottom" ? "top-arrow" : "bottom-arrow"
                        }"></div>`
                      : ""
                  }
                </div>
              `;
            }

            // 点击其他地方或按ESC键关闭气泡提示
            const closeTooltip = (e: MouseEvent | KeyboardEvent) => {
              // 如果是点击事件，检查点击位置
              if (e.type === "click") {
                const clickEvent = e as MouseEvent;
                // 如果点击的是目标元素本身，不关闭
                if (clickEvent.target === target) {
                  return;
                }
                // 如果点击的是提示内部元素，不关闭
                if (tooltipElement.contains(clickEvent.target as Node)) {
                  return;
                }
              }

              // 如果是键盘事件，检查是否按下ESC键
              if (e.type === "keydown") {
                const keyEvent = e as KeyboardEvent;
                if (keyEvent.key !== "Escape") {
                  return;
                }
              }

              // 关闭提示
              tooltipElement.style.display = "none";
              document.removeEventListener("click", closeTooltip);
              document.removeEventListener("keydown", closeTooltip);
            };

            // 延迟添加事件监听器，避免立即触发
            setTimeout(() => {
              document.addEventListener("click", closeTooltip);
              document.addEventListener("keydown", closeTooltip);
            }, 100);

            // 鼠标移出元素也关闭提示
            const mouseLeaveHandler = () => {
              // 延迟关闭，给用户时间移动到提示上
              setTimeout(() => {
                if (tooltipElement.style.display === "block") {
                  tooltipElement.style.display = "none";
                  document.removeEventListener("click", closeTooltip);
                  document.removeEventListener("keydown", closeTooltip);
                  target.removeEventListener("mouseleave", mouseLeaveHandler);
                }
              }, 300);
            };

            target.addEventListener("mouseleave", mouseLeaveHandler);
          }
        }
      }
    };

    // 添加全局点击事件监听器
    document.addEventListener("click", handleKeywordClick);

    // 组件卸载时移除事件监听器
    return () => {
      document.removeEventListener("click", handleKeywordClick);
    };
  }, []);

  // 自动滚动到底部功能（已禁用）
  useEffect(() => {
    // 已禁用自动滚动功能，用户可以手动滚动查看内容
    /*
    if (contentRef.current && isTesting) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
    */
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
            (e) => e.path === path && e.type === "file"
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
        fileContents,
        currentScan?.codeStructure // 添加代码结构信息
      );
      const parsedResult = parseFilePathsResult(jsonResult);
      const responseIndexedFiles = parsedResult.relevant_paths;
      const responseKnowledgeEntries = parsedResult.knowledge_entries || [];
      setIndexedFiles(responseIndexedFiles);
      setIsIndexing(false);

      // 创建并设置第一轮对话对象
      setDialogRounds([
        {
          userInput: initialPrompt,
          aiResponse: "",
          files:
            responseIndexedFiles.length > 0 ? responseIndexedFiles : undefined,
          knowledgeEntries: responseKnowledgeEntries,
          elementRef: currentRoundRef,
        },
      ]);

      // 构建增强的提示，包含文件内容和知识库内容
      let enhancedPrompt = initialPrompt;
      if (responseIndexedFiles.length > 0) {
        enhancedPrompt += "\n\n相关文件内容:\n\n";

        for (const path of responseIndexedFiles) {
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.type === "file"
          );
          if (entry && entry.content) {
            // 限制文件内容长度
            const truncatedContent =
              entry.content.length > 30000
                ? entry.content.substring(0, 30000) + "..."
                : entry.content;

            // 添加行号到每行
            const contentWithLineNumbers = truncatedContent
              .split("\n")
              .map((line, index) => `${index + 1} ${line}`)
              .join("\n");

            enhancedPrompt += `文件: ${path}\n\`\`\`\n${contentWithLineNumbers}\n\`\`\`\n\n`;
          }
        }

        // 添加知识库条目内容
        const knowledgeEntries = await getKnowledgeContent();
        const relevantEntries = knowledgeEntries.filter((entry) =>
          responseKnowledgeEntries.includes(entry.title)
        );

        if (relevantEntries.length > 0) {
          enhancedPrompt += "\n\n相关知识库条目:\n\n";

          for (const entry of relevantEntries) {
            // 限制知识库条目内容长度
            const truncatedContent =
              entry.text.length > 2000
                ? entry.text.substring(0, 2000) + "..."
                : entry.text;

            enhancedPrompt += `知识条目: ${entry.title}\n\`\`\`markdown\n${truncatedContent}\n\`\`\`\n\n`;
          }
        }

        // 添加明确指示，避免AI调用工具
        enhancedPrompt +=
          "\n\n请直接基于以上提供的文件内容和知识库条目回答问题，不要调用工具来获取文件内容，因为所有必要的内容已经提供给你了。";
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

      // 移除第一轮对话结束后基于AI响应的第二次向量化搜索

      // 生成对话选项
      const options = await generateDialogOptions(initialPrompt, response);
      setDialogOptions(options);
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
            (e) => e.path === path && e.type === "file"
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
      const newKnowledgeEntries = parsedResult.knowledge_entries || [];
      setIndexedFiles(newIndexedFiles);
      setIsIndexing(false);

      // 如果找到了相关文件，添加到当前轮次
      if (newIndexedFiles.length > 0) {
        newRound.files = newIndexedFiles;
      }

      // 如果找到了相关知识库条目，添加到当前轮次
      if (newKnowledgeEntries.length > 0) {
        newRound.knowledgeEntries = newKnowledgeEntries;
      }

      // 添加新轮次到对话轮次数组，以便UI立即显示用户消息
      setDialogRounds((prev) => [...prev, newRound]);

      // 构建增强的提示，包含文件内容和知识库内容
      let enhancedInput = input;

      // 添加相关文件内容
      if (newIndexedFiles.length > 0) {
        enhancedInput += "\n\n相关文件内容:\n\n";

        for (const path of newIndexedFiles) {
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.type === "file"
          );
          if (entry && entry.content) {
            // 限制文件内容长度，但增加到3000字符以包含更多上下文
            const truncatedContent =
              entry.content.length > 3000
                ? entry.content.substring(0, 3000) + "..."
                : entry.content;

            // 添加行号到每行
            const contentWithLineNumbers = truncatedContent
              .split("\n")
              .map((line, index) => `${index + 1} ${line}`)
              .join("\n");

            enhancedInput += `文件: ${path}\n\`\`\`\n${contentWithLineNumbers}\n\`\`\`\n\n`;
          }
        }
      }

      // 添加相关知识库条目内容
      if (newKnowledgeEntries.length > 0) {
        const knowledgeEntries = await getKnowledgeContent();
        const relevantEntries = knowledgeEntries.filter((entry) =>
          newKnowledgeEntries.includes(entry.title)
        );

        if (relevantEntries.length > 0) {
          enhancedInput += "\n\n相关知识库条目:\n\n";

          for (const entry of relevantEntries) {
            // 限制知识库条目内容长度
            const truncatedContent =
              entry.text.length > 2000
                ? entry.text.substring(0, 2000) + "..."
                : entry.text;

            enhancedInput += `知识条目: ${entry.title}\n\`\`\`markdown\n${truncatedContent}\n\`\`\`\n\n`;
          }
        }
      }

      // 添加明确指示，避免AI调用工具
      enhancedInput +=
        "\n\n请直接基于以上提供的文件内容和知识库条目回答问题，不要调用工具来获取文件内容，因为所有必要的内容已经提供给你了。";

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
        // 移除第二次向量化搜索，不再基于AI回复重新索引文件
        // 生成新的对话选项
        const options = await generateDialogOptions(input, response);
        setDialogOptions(options);
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
                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <motion.button
                    onClick={() => {
                      navigator.clipboard.writeText(round.aiResponse);
                    }}
                    className="flex items-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors rounded-md px-2 py-1"
                    whileHover={{
                      scale: 1.05,
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                    }}
                    whileTap={{ scale: 0.95 }}
                    title={t("copy.copied")}
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
                    <span>{t("copy.copy")}</span>
                  </motion.button>

                  {/* 添加生成需求按钮 */}
                  <motion.button
                    onClick={() => {
                      // 构建上下文，包括用户输入和AI回复
                      const context = `用户问题: ${round.userInput}\n\nAI回复: ${round.aiResponse}`;
                      setRequirementContext(context);
                      setShowRequirementGenerator(true);
                    }}
                    className="flex items-center text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors rounded-md px-2 py-1"
                    whileHover={{
                      scale: 1.05,
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                    }}
                    whileTap={{ scale: 0.95 }}
                    title={t("requirementGenerator.generate")}
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span>{t("requirementGenerator.generate")}</span>
                  </motion.button>
                </div>
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

    // 处理代码块和语言标记
    // 先标准化代码块的语言标记
    // 1. 处理有语言标记的代码块
    processed = processed.replace(
      /```(\w+)\n([\s\S]*?)```/g,
      (match, lang, code) => {
        // 保留语言标记
        return `\`\`\`${lang}\n${code}\`\`\``;
      }
    );

    // 2. 处理没有语言标记的代码块，自动检测语言
    processed = processed.replace(/```\s*\n([\s\S]*?)```/g, (match, code) => {
      const detectedLang = detectCodeLanguage(code);
      return `\`\`\`${detectedLang}\n${code}\`\`\``;
    });

    // 防止文件名和函数关键字被错误地渲染为代码块
    // 1. 修复文件名格式: 将 ```filename.ext``` 替换为 `filename.ext`
    processed = processed.replace(
      /```([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)```/g,
      "`$1`"
    );

    // 2. 修复函数名和关键字: 将 ```keyword``` 替换为 `keyword`
    processed = processed.replace(/```([a-zA-Z0-9_]+)```/g, "`$1`");

    // 3. 防止单行路径被渲染为代码块
    processed = processed.replace(
      /```((?:\/|\.\/|\.\.\/)[a-zA-Z0-9_\-\.\/]+)```/g,
      "`$1`"
    );

    // 4. 将特殊格式 `xxx` 渲染为粗体蓝色下划线文本，而不是代码块
    // 但避免修改代码块内的内容

    // 首先，将代码块内容替换为占位符，以保护它们不被处理
    const codeBlocks: string[] = [];
    processed = processed.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 转义HTML标签，防止它们被直接渲染
    processed = processed.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 然后处理单行反引号，使其可点击并显示气泡提示
    let keywordCounter = 0;
    processed = processed.replace(/`([^`]+)`/g, (match, keyword) => {
      const id = `keyword-${keywordCounter++}`;
      // 确保关键词内部的HTML标签不会被错误解析
      const escapedKeyword = keyword
        .replace(/&lt;/g, "&amp;lt;")
        .replace(/&gt;/g, "&amp;gt;");
      return `<span id="${id}" class="font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-0.5 rounded transition-colors" data-keyword="${escapedKeyword}" data-tooltip-id="${id}-tooltip" data-tooltip-content="加载中...">${escapedKeyword}</span><div id="${id}-tooltip" class="keyword-tooltip" style="display:none;"></div>`;
    });

    // 最后，恢复代码块（但确保代码块内的内容正确转义）
    codeBlocks.forEach((block, index) => {
      // 还原代码块，解除HTML转义
      processed = processed.replace(
        `__CODE_BLOCK_${index}__`,
        block.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      );
    });

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
          return options;
        } else {
          // 如果解析失败，使用默认选项
          return [
            { id: "option1", text: "请详细解释项目的核心功能" },
            { id: "option2", text: "这个项目的技术架构是什么?" },
            { id: "option3", text: "有哪些关键组件和它们的作用?" },
          ];
        }
      } catch (error) {
        console.error("解析选项JSON出错:", error);
        // 使用默认选项
        return [
          { id: "option1", text: "请详细解释项目的核心功能" },
          { id: "option2", text: "这个项目的技术架构是什么?" },
          { id: "option3", text: "有哪些关键组件和它们的作用?" },
        ];
      }
    } catch (error) {
      console.error("生成对话选项出错:", error);
      // 使用默认选项
      return [
        { id: "option1", text: "请详细解释项目的核心功能" },
        { id: "option2", text: "这个项目的技术架构是什么?" },
        { id: "option3", text: "有哪些关键组件和它们的作用?" },
      ];
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
      // 保留用户输入的换行符，不做额外处理
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

  // 处理选择预设提示
  const handleSelectPrompt = (prompt: string) => {
    setCustomInput(prompt);
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
            {t("vectorReport.aiDialog.title")}
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

        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleCustomInputSubmit} className="relative">
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl+Enter 发送
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    if (customInput.trim() && !isTesting && !isComplete) {
                      handleCustomInputSubmit(e);
                    }
                  }
                  // 普通回车换行
                  else if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
                    e.preventDefault();
                    setCustomInput((prev) => prev + "\n");
                  }
                }}
                placeholder={
                  isTesting
                    ? t("vectorReport.aiDialog.thinking") || "AI正在思考中..."
                    : t("vectorReport.aiDialog.customInputPlaceholder") ||
                      "输入您的问题...按Ctrl+Enter发送"
                }
                disabled={isTesting || isComplete}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base min-h-[80px] max-h-[200px] resize-y whitespace-pre-wrap"
                rows={4}
              />

              <div className="absolute right-2 bottom-2 sm:bottom-2.5 flex space-x-1">
                {!isTesting && !isComplete && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPresetPrompts(true)}
                      className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                      title={t("presetPrompts.button") || "提示"}
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
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOptions(!showOptions)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                      title={
                        t("vectorReport.aiDialog.optionsTitle") ||
                        "显示建议问题"
                      }
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
                  </>
                )}

                <button
                  type="submit"
                  disabled={!customInput.trim() || isTesting || isComplete}
                  className={`p-1.5 rounded-md ${
                    !customInput.trim() || isTesting || isComplete
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  }`}
                  title={t("vectorReport.aiDialog.send") || "发送"}
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
              <div className="flex items-center">
                {currentRound > 0
                  ? t("vectorReport.aiDialog.round", {
                      current: String(currentRound),
                      max: String(maxRounds),
                    })
                  : t("vectorReport.aiDialog.initializing")}
                <span className="ml-3 text-blue-500 dark:text-blue-400 hidden sm:inline-block">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 mr-1">
                    Ctrl
                  </kbd>
                  +
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 ml-1">
                    Enter
                  </kbd>{" "}
                  发送 |
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 mx-1">
                    Enter
                  </kbd>{" "}
                  换行
                </span>
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

        {/* 添加需求生成器弹窗 */}
        {showRequirementGenerator && (
          <RequirementGeneratorModal
            context={requirementContext}
            onClose={() => setShowRequirementGenerator(false)}
          />
        )}
      </div>

      {/* 添加预设提示弹窗 */}
      <PresetPromptModal
        isOpen={showPresetPrompts}
        onClose={() => setShowPresetPrompts(false)}
        onSelectPrompt={handleSelectPrompt}
      />
    </div>
  );
}
