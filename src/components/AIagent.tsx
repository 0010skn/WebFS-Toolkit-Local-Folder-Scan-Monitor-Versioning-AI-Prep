"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { useTheme } from "next-themes";
import {
  testWithAI,
  findRelevantFiles,
  parseFilePathsResult,
  getKnowledgeContent,
  chatCompletion,
  getLocalizedPrompt,
  // 新增的文件操作函数，需要在vectorizeService.ts中实现
  modifyFile,
  deleteFile,
  createFile,
} from "../lib/vectorizeService";
import Markdown from "markdown-to-jsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Light as LightSyntaxHighlighter } from "react-syntax-highlighter";
import { useAtom } from "jotai";
import { currentScanAtom } from "../lib/store";
import { KnowledgeEntry } from "../lib/knowledgeService";
import { FileSystemEntry } from "../types";

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

// 导入语法高亮样式
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

// 文件操作类型
enum FileOperationType {
  MODIFY = "modify",
  DELETE = "delete",
  CREATE = "create",
}

// 文件操作接口
interface FileOperation {
  type: FileOperationType;
  path: string;
  content?: string;
  startLine?: number;
  endLine?: number;
  newContent?: string;
}

// 组件属性接口
interface AIagentProps {
  onClose: () => void;
  initialPrompt: string;
  projectFilePaths?: string[];
}

// 对话轮次接口
interface DialogRound {
  userInput: string;
  aiResponse: string;
  files?: string[];
  responseFiles?: string[];
  elementRef?: React.RefObject<HTMLDivElement>;
  knowledgeEntries?: string[];
  fileOperations?: FileOperation[];
  hideUserInput?: boolean; // 是否隐藏用户输入气泡
  modelUsed?: string; // 新增：记录该轮使用的模型
}

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

// 创建一个增强版的Atom One Light主题
const createEnhancedAtomOneLight = () => {
  // 深拷贝atomOneLight主题
  const enhancedTheme = JSON.parse(JSON.stringify(atomOneLight));

  // 设置基本文本颜色
  if (enhancedTheme.hljs) {
    enhancedTheme.hljs.color = "#383a42";
    enhancedTheme.hljs.background = enhancedTheme.hljs.background || "#fafafa";
  } else {
    enhancedTheme.hljs = { color: "#383a42", background: "#fafafa" };
  }

  // 设置各种语法元素的颜色
  const colorMapping = {
    "hljs-comment": { color: "#a0a1a7", fontStyle: "italic" },
    "hljs-quote": { color: "#a0a1a7", fontStyle: "italic" },
    "hljs-doctag": { color: "#a626a4" },
    "hljs-keyword": { color: "#a626a4" },
    "hljs-formula": { color: "#a626a4" },
    "hljs-section": { color: "#e45649" },
    "hljs-name": { color: "#e45649" },
    "hljs-selector-tag": { color: "#e45649" },
    "hljs-deletion": { color: "#e45649" },
    "hljs-subst": { color: "#e45649" },
    "hljs-literal": { color: "#0184bb" },
    "hljs-string": { color: "#50a14f" },
    "hljs-regexp": { color: "#50a14f" },
    "hljs-addition": { color: "#50a14f" },
    "hljs-attribute": { color: "#50a14f" },
    "hljs-meta-string": { color: "#50a14f" },
    "hljs-built_in": { color: "#c18401" },
    "hljs-class .hljs-title": { color: "#c18401" },
    "hljs-attr": { color: "#986801" },
    "hljs-variable": { color: "#e45649" },
    "hljs-template-variable": { color: "#e45649" },
    "hljs-type": { color: "#986801" },
    "hljs-selector-class": { color: "#986801" },
    "hljs-selector-attr": { color: "#986801" },
    "hljs-selector-pseudo": { color: "#986801" },
    "hljs-number": { color: "#986801" },
    "hljs-symbol": { color: "#4078f2" },
    "hljs-bullet": { color: "#4078f2" },
    "hljs-link": { color: "#4078f2", textDecoration: "underline" },
    "hljs-meta": { color: "#4078f2" },
    "hljs-selector-id": { color: "#4078f2" },
    "hljs-title": { color: "#4078f2" },
    "hljs-emphasis": { fontStyle: "italic" },
    "hljs-strong": { fontWeight: "bold" },
    "hljs-params": { color: "#383a42" },
    "hljs-function .hljs-title": { color: "#4078f2" },
    "hljs-class .hljs-keyword": { color: "#a626a4" },
  };

  // 应用颜色映射到主题
  Object.entries(colorMapping).forEach(([key, styleValue]) => {
    if (!enhancedTheme[key]) enhancedTheme[key] = {};

    if (typeof styleValue === "string") {
      enhancedTheme[key].color = styleValue;
    } else if (typeof styleValue === "object") {
      Object.assign(enhancedTheme[key], styleValue);
    }
  });

  return enhancedTheme;
};

// 创建一个增强版的Atom One Dark主题
const createEnhancedAtomOneDark = () => {
  const enhancedTheme = JSON.parse(JSON.stringify(atomOneDark)); // 深拷贝

  // 确保基本文本颜色和背景设置正确
  if (enhancedTheme.hljs) {
    enhancedTheme.hljs.color = enhancedTheme.hljs.color || "#abb2bf"; // 默认文本颜色
    enhancedTheme.hljs.background = enhancedTheme.hljs.background || "#282c34"; // 默认背景色
  } else {
    enhancedTheme.hljs = { color: "#abb2bf", background: "#282c34" };
  }

  // 定义深色模式下常用HLJS标记的颜色映射
  const colorMapping = {
    "hljs-comment": { color: "#7f848e", fontStyle: "italic" },
    "hljs-quote": { color: "#7f848e", fontStyle: "italic" },
    "hljs-doctag": { color: "#c678dd" },
    "hljs-keyword": { color: "#c678dd" },
    "hljs-formula": { color: "#c678dd" },
    "hljs-section": { color: "#e06c75" }, // 通常用于MD中的标题
    "hljs-name": { color: "#e06c75" }, // HTML/XML中的标签名，CSS选择器
    "hljs-selector-tag": { color: "#e06c75" },
    "hljs-deletion": { color: "#e06c75" },
    "hljs-subst": { color: "#e06c75" }, // 替换的默认颜色
    "hljs-literal": { color: "#56b6c2" }, // true, false, null
    "hljs-string": { color: "#98c379" },
    "hljs-regexp": { color: "#98c379" },
    "hljs-addition": { color: "#98c379" },
    "hljs-attribute": { color: "#d19a66" }, // HTML属性
    "hljs-meta-string": { color: "#98c379" },
    "hljs-built_in": { color: "#e6c07b" }, // print, console等
    "hljs-class .hljs-title": { color: "#e6c07b" }, // 类名
    "hljs-title": { color: "#61afef" }, // 函数名，类名(也见上面)
    "hljs-attr": { color: "#d19a66" }, // 标签中的属性，如<div attr="val">
    "hljs-variable": { color: "#e06c75" }, // 变量名
    "hljs-template-variable": { color: "#e06c75" },
    "hljs-type": { color: "#e6c07b" }, // 类型注解
    "hljs-selector-class": { color: "#e6c07b" },
    "hljs-selector-attr": { color: "#d19a66" },
    "hljs-selector-pseudo": { color: "#d19a66" },
    "hljs-number": { color: "#d19a66" },
    "hljs-symbol": { color: "#56b6c2" }, // 符号，如Ruby中的符号
    "hljs-bullet": { color: "#56b6c2" }, // MD中的列表项
    "hljs-link": { color: "#61afef", textDecoration: "underline" },
    "hljs-meta": { color: "#c678dd" }, // 元关键字，如Python中的@修饰器，import/export如果不是关键字
    "hljs-selector-id": { color: "#61afef" },
    "hljs-emphasis": { fontStyle: "italic" },
    "hljs-strong": { fontWeight: "bold" },
    "hljs-params": { color: "#abb2bf" }, // 函数参数（通常为默认颜色）
    "hljs-function .hljs-title": { color: "#61afef" }, // 更具体的函数名
    "hljs-class .hljs-keyword": { color: "#c678dd" }, // 类上下文中的关键字
  };

  Object.entries(colorMapping).forEach(([key, styleValue]) => {
    if (!enhancedTheme[key]) enhancedTheme[key] = {};

    if (typeof styleValue === "string") {
      enhancedTheme[key].color = styleValue;
    } else if (typeof styleValue === "object") {
      Object.assign(enhancedTheme[key], styleValue);
    }
  });

  return enhancedTheme;
};

// 创建增强版主题
const enhancedAtomOneLight = createEnhancedAtomOneLight();
const enhancedAtomOneDark = createEnhancedAtomOneDark();

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

  // 确保children是字符串
  const codeContent =
    typeof children === "string" ? children : String(children || "");

  // 从className中提取语言信息，移除可能的前缀
  let language = className ? className.replace(/language-/, "") : "";

  // 如果语言是text或未指定，尝试自动检测语言
  if (!language || language === "text" || language === "plaintext") {
    const detected = detectCodeLanguage(codeContent);
    if (detected !== "text") {
      // 只有当检测到的语言比text更具体时才使用
      language = detected;
    }
  }

  const [copied, setCopied] = useState(false);

  // 如果是单行内联代码且内容较短，使用内联代码样式
  const isSingleLineInline =
    !codeContent.includes("\n") && codeContent.trim().length < 80 && !className;
  if (isSingleLineInline) {
    return (
      <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">
        {codeContent.trim()}
      </code>
    );
  }

  // 复制代码功能
  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 确定使用哪种高亮器和样式
  // JSX, TSX和高度结构化的语言如Regex受益于Prism的更详细的语法
  const prismLanguages = [
    "jsx",
    "tsx",
    "regex",
    "graphql",
    "typescript",
    "javascript",
  ]; // 扩展的Prism列表

  const usePrism = prismLanguages.includes(language);

  const HighlighterComponent = usePrism
    ? SyntaxHighlighter // Prism完整版
    : LightSyntaxHighlighter; // HLJS轻量版

  // 选择样式
  // 对于HLJS (LightSyntaxHighlighter)
  const hljsStyle = isDark ? enhancedAtomOneDark : enhancedAtomOneLight;
  // 对于Prism (SyntaxHighlighter)
  const prismStyle = isDark ? vscDarkPlus : prism; // `prism`是一个浅色的prism主题

  const styleToUse = usePrism ? prismStyle : hljsStyle;

  // <pre>标签的基本样式，两种高亮器通用
  const preCustomStyle = {
    margin: 0,
    padding: "1rem", // 一致的内边距
    fontSize: "14px",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    lineHeight: 1.6,
    // 背景和文本颜色将由`styleToUse`（主题对象）应用到<pre>标签本身
    borderRadius: "0px", // pre没有圆角，容器div有圆角
    overflowX: "initial" as "initial", // 让父div处理滚动
    width: "max-content",
    minWidth: "100%",
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden my-2 w-full max-w-full syntax-highlighter-container">
      <div className="bg-gray-200 dark:bg-gray-600 px-4 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between sticky top-0 z-10">
        <span className="flex items-center">
          {language && language !== "text" && (
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
      <div
        className="overflow-x-auto w-full code-scroll-container"
        style={{ WebkitOverflowScrolling: "touch", maxWidth: "100%" }}
      >
        <HighlighterComponent
          language={language || "text"}
          style={styleToUse} // 应用主题（标记颜色，pre背景/颜色）
          customStyle={preCustomStyle} // 应用附加样式到<pre>标签
          showLineNumbers={
            language !== "text" &&
            language !== "" &&
            !usePrism && // Prism（完整SyntaxHighlighter）不像Light那样简单支持此属性
            // 如果需要Prism的行号，需要不同的设置或CSS
            codeContent.split("\n").length > 1
          }
          wrapLines={true} // 可选：如果你希望行换行
          lineNumberStyle={{
            minWidth: "3.25em", // 为可能的大行号调整
            paddingRight: "1em",
            color: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)", // 更柔和的颜色
            borderRight: isDark
              ? "1px solid rgba(255, 255, 255, 0.1)"
              : "1px solid rgba(0, 0, 0, 0.1)",
            marginRight: "1em",
            userSelect: "none",
            textAlign: "right",
            fontSize: "12px", // 稍小的行号
          }}
          // 对于<pre>内的<code>标签
          // 它通常应该从<pre>继承
          codeTagProps={{
            style: {
              fontFamily: "inherit",
              fontSize: "inherit",
              lineHeight: "inherit",
              // 特定标记颜色由高亮器应用到此<code>标签内的span
            },
          }}
        >
          {codeContent}
        </HighlighterComponent>
      </div>
    </div>
  );
};

// 文件操作卡片组件
const FileOperationCard = ({
  operation,
  onApprove,
  onReject,
}: {
  operation: FileOperation;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const { t } = useTranslations();

  return (
    <div className="my-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 font-medium flex items-center justify-between">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 mr-2 ${
              operation.type === FileOperationType.MODIFY
                ? "text-yellow-500"
                : operation.type === FileOperationType.DELETE
                ? "text-red-500"
                : "text-green-500"
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            {operation.type === FileOperationType.MODIFY ? (
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            ) : operation.type === FileOperationType.DELETE ? (
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            ) : (
              <path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM8 7a2 2 0 100-4 2 2 0 000 4zm.256 7a4.474 4.474 0 01-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256z" />
            )}
          </svg>
          <span className="text-sm truncate">
            {operation.type === FileOperationType.MODIFY
              ? t("aiagent.modifyFile")
              : operation.type === FileOperationType.DELETE
              ? t("aiagent.deleteFile")
              : t("aiagent.createFile")}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t("aiagent.filePath")}:
          </div>
          <div className="bg-white/80 dark:bg-gray-900/50 rounded p-2 text-sm overflow-x-auto">
            <div className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {operation.path}
            </div>
          </div>
        </div>

        {operation.type === FileOperationType.MODIFY && (
          <>
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t("aiagent.lineRange")}: {operation.startLine} -{" "}
                {operation.endLine}
              </div>
            </div>
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t("aiagent.changes")}:
              </div>
              <div className="bg-white/80 dark:bg-gray-900/50 rounded p-2 text-sm overflow-x-auto max-h-40">
                <div className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {operation.newContent}
                </div>
              </div>
            </div>
          </>
        )}

        {operation.type === FileOperationType.CREATE && (
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t("aiagent.newContent")}:
            </div>
            <div className="bg-white/80 dark:bg-gray-900/50 rounded p-2 text-sm overflow-x-auto max-h-40">
              <div className="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {operation.content}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-3">
          <button
            onClick={onReject}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t("aiagent.reject")}
          </button>
          <button
            onClick={onApprove}
            className={`px-3 py-1 text-white rounded text-sm transition-colors ${
              operation.type === FileOperationType.MODIFY
                ? "bg-yellow-500 hover:bg-yellow-600"
                : operation.type === FileOperationType.DELETE
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {t("aiagent.approve")}
          </button>
        </div>
      </div>
    </div>
  );
};

// 主要AIagent组件
export default function AIagent({
  onClose,
  initialPrompt,
  projectFilePaths = [],
}: AIagentProps) {
  // 添加样式到head
  useEffect(() => {
    // 创建样式元素
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      /* 基础容器字体大小（可选，如果Tailwind没有有效处理） */
      /* .syntax-highlighter-container { font-size: 14px; } */

      /* 代码块字体和行高现在主要由CodeBlock中的customStyle属性设置 */
      /* 确保pre和code内部占用全宽以便于复制粘贴 */
      .syntax-highlighter-container pre,
      .syntax-highlighter-container code {
        white-space: pre; /* 允许行内正常文本换行，如果wrapLines为true */
                         /* 或者使用pre-wrap以便同时保留空白并换行 */
      }

      /* 滚动条样式（这些是好的） */
      .code-scroll-container {
        scrollbar-width: thin;
        scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
      }
      .code-scroll-container::-webkit-scrollbar { height: 8px; width: 8px; } /* 稍大的滚动条 */
      .code-scroll-container::-webkit-scrollbar-track { background: transparent; }
      .code-scroll-container::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
      }
      .dark .code-scroll-container::-webkit-scrollbar-thumb {
        background-color: rgba(75, 85, 99, 0.5);
      }

      /* 移动设备优化（这些是好的） */
      @media (max-width: 640px) {
        .syntax-highlighter-container {
          /* width: calc(100% + 2rem) !important; */ /* 小心使用!important */
          /* margin-left: -1rem !important; */
          /* margin-right: -1rem !important; */
          border-radius: 0 !important;
        }
        .code-scroll-container pre {
          /* max-width: 100% !important; */ /* 让overflow-x-auto处理它 */
        }
      }

      /* Prism主题（vscDarkPlus/prism）可能无法很好处理的特定修复，如Python装饰器 */
      /* 这针对Prism的.token结构 */
      .syntax-highlighter-container pre[class*="language-python"] .token.decorator .token.punctuation,
      .syntax-highlighter-container pre[class*="language-python"] .token.decorator .token.function {
        /* color: #c678dd; */ /* 来自vscDarkPlus的深色模式装饰器颜色，根据需要调整 */
      }
      body:not(.dark) .syntax-highlighter-container pre[class*="language-python"] .token.decorator .token.punctuation,
      body:not(.dark) .syntax-highlighter-container pre[class*="language-python"] .token.decorator .token.function {
        /* color: #a626a4; */ /* 来自prism主题的浅色模式装饰器颜色，根据需要调整 */
      }
      
      /* Python装饰器在HLJS主题中的.hljs-meta修复现在由enhancedAtomOneDark/Light处理 */

      /* 修复Prism的vscDarkPlus主题有时把标点符号设置得太暗的问题 */
      .dark .syntax-highlighter-container pre[class*="language-"] .token.punctuation {
        /* color: #abb2bf; /* 或者稍亮的标点符号颜色，如果需要 */
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []); // 空依赖数组，只运行一次

  const { t } = useTranslations();
  const [dialogRounds, setDialogRounds] = useState<DialogRound[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const maxRounds = 60;
  const [responseSegments, setResponseSegments] = useState<{
    [key: number]: string;
  }>({});
  const [indexedFiles, setIndexedFiles] = useState<string[]>([]);
  const [filePaths] = useState<string[]>(projectFilePaths);
  const [currentResponse, setCurrentResponse] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [currentScan] = useAtom(currentScanAtom);
  const currentRoundRef = useRef<HTMLDivElement>(null);

  // 新增用户输入状态
  const [userInput, setUserInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 权限状态
  const [hasPermission, setHasPermission] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<FileOperation[]>(
    []
  );
  const [processingOperation, setProcessingOperation] = useState(false);

  // 自动模式状态 - 默认启用
  const [autoMode, setAutoMode] = useState(true);

  // 任务状态跟踪
  const [taskStatus, setTaskStatus] = useState<
    "planning" | "executing" | "completed" | "waiting"
  >("planning");
  // 移除自动执行相关的状态，改为手动控制
  const [showExecuteInput, setShowExecuteInput] = useState(false);
  const [executeCommand, setExecuteCommand] = useState("");

  // ===== 新增：模型常量 =====
  const PLANNING_MODEL = "openai-reasoning";
  const EXECUTION_MODEL = "openai-large";

  // 1. 新增 estimatedTime 状态
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);

  // 初始化对话
  useEffect(() => {
    if (initialPrompt && !dialogRounds.length && !isTesting) {
      startConversation();
    }
  }, [initialPrompt]);

  // 开始对话
  const startConversation = async () => {
    setIsTesting(true);
    setIsComplete(false);
    setCurrentRound(0);
    setDialogRounds([]);
    setResponseSegments({});
    setConversationHistory([]);

    try {
      // 首先索引相关文件
      setIsIndexing(true);
      const relevantFilesResult = await findRelevantFiles(
        initialPrompt,
        filePaths
      );
      setIsIndexing(false);

      const parsedResult = parseFilePathsResult(relevantFilesResult);
      const relevantFiles = parsedResult.relevant_paths || [];
      setIndexedFiles(relevantFiles);

      // 创建第一轮对话
      const newRound: DialogRound = {
        userInput: initialPrompt,
        aiResponse: "",
        files: relevantFiles,
        hideUserInput: true, // 隐藏第一轮用户输入气泡
        modelUsed: PLANNING_MODEL, // 记录模型
      };

      setDialogRounds([newRound]);
      setCurrentRound(1);

      // 构建系统提示词
      const systemPrompt = getLocalizedPrompt(
        `你是一个强大的AI代码智能体，能够帮助用户修改、删除和创建文件。你可以直接操作用户的代码库，并具有高级编程理解能力。

## 智能体协作模式
你现在处于协作模式，这意味着：
1. **任务导向**：你需要专注于完成用户给定的任务
2. **分步执行**：将复杂任务分解为多个步骤，每步都等待用户确认
3. **清晰沟通**：明确说明当前进度和下一步计划
4. **用户控制**：每一步都需要用户决定是否继续

## 任务状态管理
你需要在每次回复中明确标识当前的任务状态：

\`\`\`task-status
status: planning|executing|completed
code: 要改动的完整、真实代码（禁止伪代码、占位符或省略号）
progress: 当前进度描述
next_action: 下一步行动计划（如果有的话）
\`\`\`

- **planning**: 正在分析任务和制定计划
- **executing**: 正在执行具体的操作
- **completed**: 任务已完成
- **code**: 要改动的完整、可编译代码（必须包含，禁止伪代码、占位符或省略号）

## 协作机制
在每轮对话中，你应该：
1. 明确说明当前完成了什么
2. 如果任务未完成，在 next_action 中描述建议的下一步行动
3. 等待用户决定是否继续执行下一步
4. 只有当任务真正完成时，才将状态设为 completed

请特别注意：
1. 请记住完整的对话历史，理解用户的问题可能是对之前对话的延续。
2. 如果用户提供简短回复（如"是的"、"好的"、"明天呢"），应理解为对之前对话的回应或延续。
3. 只有当用户明确提出新问题或改变话题时，才切换到新话题。
4. 当用户提出非代码相关的问题，请自然地回答，不要强行引导回代码话题。
5. 避免在每次回复中都询问是否需要帮助编写代码。

## 编程能力增强指南
1. **代码理解与分析**：
   - 主动分析代码结构、设计模式和架构
   - 识别潜在的代码问题、性能瓶颈和安全漏洞
   - 理解不同编程语言的特性和最佳实践

2. **智能代码生成**：
   - 生成符合项目风格和约定的代码
   - 自动添加适当的注释和文档
   - 考虑边界情况和异常处理
   - 遵循SOLID、DRY等编程原则

3. **上下文感知**：
   - 记住并理解之前的对话内容和代码修改
   - 基于项目的整体结构提供建议
   - 考虑代码修改的连锁反应和依赖关系

4. **主动建议**：
   - 提供代码优化和重构建议
   - 推荐更现代、更高效的实现方式
   - 建议添加测试以确保代码质量

## 文件操作指南
当需要修改文件时，你应该：
1. 明确指出要修改的文件路径
2. 指定要修改的行号范围（起始行到结束行）
3. 提供新的内容
4. 解释修改的目的和影响

当需要删除文件时，你应该：
1. 明确指出要删除的文件路径
2. 解释为什么需要删除该文件
3. 评估删除可能带来的影响

当需要创建文件时，你应该：
1. 明确指出要创建的文件路径
2. 提供完整的文件内容
3. 解释文件的用途和它如何与项目其他部分集成

## 文件操作格式
你的回复应该使用以下格式来表示文件操作：

对于修改文件：
\`\`\`file-operation
type: modify
path: 文件路径
startLine: 起始行号
endLine: 结束行号
content:
新的内容
\`\`\`

对于删除文件：
\`\`\`file-operation
type: delete
path: 文件路径
\`\`\`

对于创建文件：
\`\`\`file-operation
type: create
path: 文件路径
content:
文件内容
\`\`\`

每次操作都需要用户确认后才能执行。请确保你的操作是安全的，并且不会破坏用户的代码库。`,
        `You are a powerful AI code agent that can help users modify, delete, and create files. You can directly operate on the user's codebase with advanced programming understanding.

## Intelligent Agent Collaboration Mode
You are now in collaboration mode, which means:
1. **Task-Oriented**: Focus on completing the user's given task
2. **Step-by-Step Execution**: Break complex tasks into multiple steps, waiting for user confirmation at each step
3. **Clear Communication**: Clearly explain current progress and next step plans
4. **User Control**: Each step requires user decision to continue

## Task Status Management
You need to clearly identify the current task status in each response:

\`\`\`task-status
status: planning|executing|completed
code: exact compilable code changes (NO pseudocode, placeholders or ellipses)
progress: Current progress description
next_action: Next action plan (if applicable)
\`\`\`

- **planning**: Analyzing task and formulating plan
- **executing**: Performing specific operations
- **completed**: Task completed
- **code**: exact compilable code to be modified (must be included, NO pseudocode, placeholders or ellipses)

## Collaboration Mechanism
In each round of conversation, you should:
1. Clearly explain what has been completed
2. If the task is not finished, describe the suggested next action in next_action
3. Wait for user decision on whether to continue to the next step
4. Only set status to completed when the task is truly finished

Please pay special attention:
1. Remember the complete conversation history and understand that the user's question may be a continuation of the previous conversation.
2. If the user provides a short reply (such as "yes", "okay", "tomorrow?"), interpret it as a response to or continuation of the previous conversation.
3. Only switch to a new topic when the user clearly asks a new question or changes the topic.
4. When users ask non-code related questions, answer naturally without forcing the conversation back to code topics.
5. Avoid asking in every reply whether the user needs help writing code.

## Enhanced Programming Capabilities
1. **Code Understanding & Analysis**:
   - Actively analyze code structure, design patterns, and architecture
   - Identify potential code issues, performance bottlenecks, and security vulnerabilities
   - Understand features and best practices of different programming languages

2. **Intelligent Code Generation**:
   - Generate code that matches project style and conventions
   - Automatically add appropriate comments and documentation
   - Consider edge cases and exception handling
   - Follow SOLID, DRY, and other programming principles

3. **Context Awareness**:
   - Remember and understand previous conversation content and code modifications
   - Provide suggestions based on the overall project structure
   - Consider the ripple effects and dependencies of code changes

4. **Proactive Suggestions**:
   - Offer code optimization and refactoring suggestions
   - Recommend more modern and efficient implementation approaches
   - Suggest adding tests to ensure code quality

## File Operation Guidelines
When you need to modify a file, you should:
1. Clearly indicate the file path to be modified
2. Specify the line number range to be modified (start line to end line)
3. Provide the new content
4. Explain the purpose and impact of the modification

When you need to delete a file, you should:
1. Clearly indicate the file path to be deleted
2. Explain why the file needs to be deleted
3. Assess the potential impact of the deletion

When you need to create a file, you should:
1. Clearly indicate the file path to be created
2. Provide the complete file content
3. Explain the purpose of the file and how it integrates with other parts of the project

## File Operation Format
Your response should use the following format to represent file operations:

For modifying files:
\`\`\`file-operation
type: modify
path: file_path
startLine: start_line_number
endLine: end_line_number
content:
new_content
\`\`\`

For deleting files:
\`\`\`file-operation
type: delete
path: file_path
\`\`\`

For creating files:
\`\`\`file-operation
type: create
path: file_path
content:
file_content
\`\`\`

Each operation needs to be confirmed by the user before execution. Please ensure that your operations are safe and will not damage the user's codebase.`
      );

      // 构建增强的用户提示词，包含文件内容
      let enhancedPrompt = initialPrompt;

      // 添加相关文件内容
      if (relevantFiles.length > 0) {
        enhancedPrompt += "\n\n相关文件内容:\n\n";

        for (const path of relevantFiles) {
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.type === "file"
          );
          if (entry && entry.content) {
            // 查找该文件中的函数和方法信息
            const functions = currentScan?.codeStructure?.functions?.filter(
              (func) => func.filePath === path
            );

            // 如果有函数信息，添加到文件内容中
            let enhancedContent = entry.content;
            if (functions && functions.length > 0) {
              enhancedContent = `/* 文件中的函数和方法:
${functions
  .map((func) => `${func.type}: ${func.name} [行 ${func.lines.join("-")}]`)
  .join("\n")}
*/\n\n${entry.content}`;
            }

            // 限制文件内容长度
            const truncatedContent =
              enhancedContent.length > 3000
                ? enhancedContent.substring(0, 3000) + "..."
                : enhancedContent;

            // 添加行号到每行，但跳过函数信息注释
            const contentWithLineNumbers = (() => {
              const lines = truncatedContent.split("\n");

              // 检查是否包含函数信息注释
              const hasFunctionInfo =
                lines.length > 2 &&
                lines[0].includes("文件中的函数和方法:") &&
                lines[0].startsWith("/*");

              // 找到实际内容的起始行
              let startIndex = 0;
              if (hasFunctionInfo) {
                // 查找注释结束位置
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes("*/")) {
                    // 注释结束行的下一行才是实际内容
                    startIndex = i + 1;
                    // 如果下一行是空行，再跳过一行
                    if (
                      startIndex < lines.length &&
                      !lines[startIndex].trim()
                    ) {
                      startIndex++;
                    }
                    break;
                  }
                }
              }

              // 只给实际内容添加行号
              return lines
                .map((line, index) => {
                  // 如果是函数信息注释部分，不添加行号
                  if (index < startIndex) {
                    return line;
                  }
                  // 对实际内容添加行号，行号从1开始
                  return `${index - startIndex + 1} ${line}`;
                })
                .join("\n");
            })();

            enhancedPrompt += `文件: ${path}\n\`\`\`\n${contentWithLineNumbers}\n\`\`\`\n\n`;
          }
        }
      }

      // 添加到对话历史 - 确保保存完整的增强提示，包括文件内容
      const history = [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhancedPrompt },
      ];

      // 使用setState回调确保状态更新完成
      setConversationHistory(history);

      // 获取AI响应
      let response = "";
      await chatCompletion(history, {
        model: PLANNING_MODEL, // <<<<<< 使用规划模型
        stream: true,
        onUpdate: (chunk) => {
          response += chunk;
          setResponseSegments((prev) => ({
            ...prev,
            [0]: (prev[0] || "") + chunk,
          }));
          setCurrentResponse(response);
        },
      });

      // 解析任务状态
      const taskStatusInfo = parseTaskStatus(response);
      setTaskStatus(taskStatusInfo.status);

      // ===== 解析文件操作（无论什么阶段都解析） =====
      let fileOperations: FileOperation[] = parseFileOperations(response);
      // 只有 executing 阶段才真正挂起待处理操作
      if (taskStatusInfo.status === "executing" && fileOperations.length) {
        setPendingOperations(fileOperations);
      }

      // 根据任务状态设置完成状态
      if (taskStatusInfo.status === "completed") {
        setIsComplete(true);
      } else {
        setIsComplete(false);
      }

      // 更新对话轮次
      setDialogRounds((prev) => {
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          aiResponse: response,
          fileOperations: fileOperations,
        };
        return updated;
      });

      // 添加到对话历史，确保不重复添加
      setConversationHistory((prev) => {
        // 检查最后一条消息是否已经是AI响应
        const lastMessage = prev[prev.length - 1];
        const isLastMessageFromAI =
          lastMessage && lastMessage.role === "assistant";

        // 如果最后一条消息不是AI响应，或者内容与当前响应不同，则添加新的AI响应
        if (!isLastMessageFromAI || lastMessage.content !== response) {
          console.log("添加新的AI响应到初始对话历史");
          return [...prev, { role: "assistant", content: response }];
        } else {
          console.log("AI响应已存在于初始对话历史中，不重复添加");
          return prev;
        }
      });

      // 不再自动执行，每轮都等待用户决定
      // 只有当任务状态为completed时才设置为完成
      if (taskStatusInfo.status === "completed") {
        setIsComplete(true);
      } else {
        setIsComplete(false);
        // 显示继续按钮，让用户决定是否继续
      }

      console.log(
        "初始对话处理完成 - 任务状态:",
        taskStatusInfo.status,
        "是否完成:",
        taskStatusInfo.status === "completed"
      );
    } catch (error) {
      console.error("对话初始化错误:", error);
      // 发生错误时也要重置状态
      setIsComplete(false);
    } finally {
      // 确保处理完成后重置测试状态，允许用户继续输入
      setIsTesting(false);
      console.log("初始对话状态已重置 - 可以继续输入");
    }
  };

  // 解析文件操作
  const parseFileOperations = (text: string): FileOperation[] => {
    const operations: FileOperation[] = [];
    const regex = /```file-operation\s+([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const content = match[1];

      // 解析操作类型
      const typeMatch = content.match(/type:\s*(\w+)/);
      if (!typeMatch) continue;

      const type = typeMatch[1].toLowerCase();

      // 解析文件路径
      const pathMatch = content.match(/path:\s*([^\n]+)/);
      if (!pathMatch) continue;

      const path = pathMatch[1].trim();

      if (type === "modify") {
        // 解析修改操作
        const startLineMatch = content.match(/startLine:\s*(\d+)/);
        const endLineMatch = content.match(/endLine:\s*(\d+)/);
        const contentMatch = content.match(/content:\s*\n([\s\S]*?)$/);

        if (!startLineMatch || !endLineMatch || !contentMatch) continue;

        operations.push({
          type: FileOperationType.MODIFY,
          path,
          startLine: parseInt(startLineMatch[1]),
          endLine: parseInt(endLineMatch[1]),
          newContent: contentMatch[1].trim(),
        });
      } else if (type === "delete") {
        // 解析删除操作
        operations.push({
          type: FileOperationType.DELETE,
          path,
        });
      } else if (type === "create") {
        // 解析创建操作
        const contentMatch = content.match(/content:\s*\n([\s\S]*?)$/);

        if (!contentMatch) continue;

        operations.push({
          type: FileOperationType.CREATE,
          path,
          content: contentMatch[1].trim(),
        });
      }
    }

    return operations;
  };

  // 解析任务状态
  const parseTaskStatus = (
    text: string
  ): {
    status: "planning" | "executing" | "completed";
    progress: string;
    nextAction?: string;
  } => {
    const regex = /```task-status\s+([\s\S]*?)```/;
    const match = text.match(regex);

    if (!match) {
      // 如果没有找到任务状态标记，根据内容推断
      if (
        text.includes("完成") ||
        text.includes("completed") ||
        text.includes("任务已完成")
      ) {
        return { status: "completed", progress: "任务已完成" };
      }
      // 默认视为规划阶段
      return { status: "planning", progress: "正在规划" };
    }

    const content = match[1];

    // 解析状态
    const statusMatch = content.match(/status:\s*(\w+)/);
    const status = (statusMatch?.[1] as any) || "executing";

    // 解析进度
    const progressMatch = content.match(/progress:\s*([^\n]+)/);
    const progress = progressMatch?.[1]?.trim() || "正在处理中";

    // 解析下一步行动
    const nextActionMatch = content.match(/next_action:\s*([^\n]+)/);
    const nextAction = nextActionMatch?.[1]?.trim();

    return { status, progress, nextAction };
  };

  // 处理文件操作
  const handleFileOperation = async (operation: FileOperation) => {
    setProcessingOperation(true);

    try {
      switch (operation.type) {
        case FileOperationType.MODIFY:
          if (
            operation.startLine !== undefined &&
            operation.endLine !== undefined &&
            operation.newContent !== undefined
          ) {
            await modifyFile(
              operation.path,
              operation.startLine,
              operation.endLine,
              operation.newContent
            );
          }
          break;

        case FileOperationType.DELETE:
          await deleteFile(operation.path);
          break;

        case FileOperationType.CREATE:
          if (operation.content !== undefined) {
            await createFile(operation.path, operation.content);
          }
          break;
      }

      // 从待处理列表中移除
      setPendingOperations((prev) => prev.filter((op) => op !== operation));
    } catch (error) {
      console.error("文件操作错误:", error);
    } finally {
      setProcessingOperation(false);
    }
  };

  // 一键应用所有待处理操作
  const handleApplyAllOperations = async () => {
    setProcessingOperation(true);

    try {
      // 1) 先处理创建
      for (const op of pendingOperations.filter(
        (o) => o.type === FileOperationType.CREATE
      )) {
        if (op.content !== undefined) {
          await createFile(op.path, op.content);
        }
      }

      // 2) 处理修改：同一文件按起始行号降序，避免行号错位
      const modifyGroups: { [key: string]: FileOperation[] } = {};
      pendingOperations
        .filter((o) => o.type === FileOperationType.MODIFY)
        .forEach((op) => {
          if (!modifyGroups[op.path]) modifyGroups[op.path] = [];
          modifyGroups[op.path].push(op);
        });

      for (const [filePath, ops] of Object.entries(modifyGroups)) {
        const ordered = ops.sort(
          (a, b) => (b.startLine ?? 0) - (a.startLine ?? 0)
        );
        for (const op of ordered) {
          if (
            op.startLine !== undefined &&
            op.endLine !== undefined &&
            op.newContent !== undefined
          ) {
            await modifyFile(filePath, op.startLine, op.endLine, op.newContent);
          }
        }
      }

      // 3) 最后处理删除
      for (const op of pendingOperations.filter(
        (o) => o.type === FileOperationType.DELETE
      )) {
        await deleteFile(op.path);
      }

      // 清空待处理列表
      setPendingOperations([]);
    } catch (error) {
      console.error("批量文件操作错误:", error);
    } finally {
      setProcessingOperation(false);
    }
  };

  // 手动继续下一步
  const handleContinueTask = async () => {
    if (isTesting) return; // 防止重复执行

    // 使用默认的继续提示
    const continuePrompt = "请继续执行任务，基于之前的分析和计划。";

    // 直接调用handleSubmit的逻辑，但使用继续提示
    setUserInput(continuePrompt);
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  // 处理执行命令
  const handleExecuteCommand = async () => {
    if (isTesting || !executeCommand.trim()) return;

    // 使用用户输入的执行命令
    setUserInput(executeCommand);
    setExecuteCommand(""); // 清空执行命令
    setShowExecuteInput(false); // 隐藏输入框

    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  // 显示执行输入框
  const handleShowExecuteInput = () => {
    setShowExecuteInput(true);
    setExecuteCommand("");
  };

  // 处理权限请求
  const handlePermissionRequest = () => {
    setHasPermission(true);
  };

  // 2. 新增 handleExecuteNow，点击执行按钮直接发送固定 prompt
  const handleExecuteNow = () => {
    if (isTesting) return;
    const fixedPrompt =
      t("aiagent.defaultExecutePrompt") || "基于上面的规划,改吧";
    setUserInput(fixedPrompt);
    setTimeout(() => {
      handleSubmit();
    }, 50);
  };

  // 处理用户输入提交
  const handleSubmit = async () => {
    if (!userInput.trim() || isTesting) {
      console.log("提交被阻止 - 输入为空或正在处理中:", {
        inputEmpty: !userInput.trim(),
        isTesting,
      });
      return;
    }

    // 预估思考时间：每 30 字 1 秒，最短 2 秒，最长 15 秒
    const sec = Math.max(2, Math.min(15, Math.ceil(userInput.length / 30)));
    setEstimatedTime(sec);
    setIsSubmitting(true);
    setIsTesting(true);
    setTaskStatus("planning");

    try {
      // 创建新的对话轮次
      const newRound: DialogRound = {
        userInput: userInput,
        aiResponse: "",
        modelUsed: EXECUTION_MODEL, // 记录模型
      };

      // 添加到对话轮次
      setDialogRounds((prev) => [...prev, newRound]);

      // 更新当前轮次
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);

      // 获取完整对话历史的副本
      const updatedHistory = [...conversationHistory];

      // 检查最后一条消息是否是用户消息，如果是，可能是重复的
      const lastMessage = updatedHistory[updatedHistory.length - 1];
      const isLastMessageFromUser = lastMessage && lastMessage.role === "user";

      // 如果最后一条消息不是用户消息，或者内容与当前输入不同，则添加新的用户消息
      if (!isLastMessageFromUser || lastMessage.content !== userInput) {
        console.log("添加新的用户输入到对话历史:", userInput);
        updatedHistory.push({ role: "user", content: userInput });
      } else {
        console.log("用户输入已存在于对话历史中，不重复添加");
      }

      setConversationHistory(updatedHistory);

      // 清空输入框
      setUserInput("");

      // 首先索引相关文件
      setIsIndexing(true);
      const relevantFilesResult = await findRelevantFiles(userInput, filePaths);
      setIsIndexing(false);

      const parsedResult = parseFilePathsResult(relevantFilesResult);
      const relevantFiles = parsedResult.relevant_paths || [];
      setIndexedFiles(relevantFiles);

      // 更新对话轮次，添加相关文件
      setDialogRounds((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          const lastIndex = updated.length - 1;
          updated[lastIndex] = {
            ...updated[lastIndex],
            files: relevantFiles,
          };
        }
        return updated;
      });

      // 获取AI响应 - 传递当前轮次索引和用户输入
      const currentUserInputForAI = userInput; // 保存当前用户输入
      console.log("传递给AI的当前用户输入:", currentUserInputForAI);
      await continueConversation(
        nextRound - 1,
        relevantFiles,
        currentUserInputForAI
      );
      console.log("handleSubmit - AI响应处理完成");
    } catch (error) {
      console.error("提交用户输入错误:", error);
      // 发生错误时也要重置状态
      setIsComplete(false);
    } finally {
      // 只重置提交状态，isTesting状态由continueConversation负责重置
      setIsSubmitting(false);
      console.log("handleSubmit - 提交状态已重置");
      // 4. handleSubmit finally 清空 ETA
      setIsTesting(false);
      setEstimatedTime(null);
    }
  };

  // 处理输入框按键事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 继续对话
  const continueConversation = async (
    roundIndex: number,
    relevantFiles: string[] = [],
    userInputOverride: string = "", // 新增参数，接收当前用户输入
    modelToUse: string = EXECUTION_MODEL // <<<<<< 新增参数，默认执行模型
  ) => {
    console.log(
      "继续对话 - 轮次:",
      roundIndex,
      "相关文件数:",
      relevantFiles.length,
      "用户输入覆盖:",
      userInputOverride ? "是" : "否"
    );
    setIsTesting(true);

    try {
      // 确定要使用的用户输入
      let effectiveUserInput = "";

      // 优先使用传入的覆盖输入
      if (userInputOverride) {
        effectiveUserInput = userInputOverride;
        console.log("使用传入的用户输入覆盖");
      }
      // 其次尝试从对话轮次获取
      else if (dialogRounds[roundIndex] && dialogRounds[roundIndex].userInput) {
        effectiveUserInput = dialogRounds[roundIndex].userInput;
        console.log("使用对话轮次中的用户输入");
      }
      // 最后尝试从对话历史获取
      else {
        const lastUserMessage = conversationHistory
          .filter((msg) => msg.role === "user")
          .pop();
        if (lastUserMessage) {
          effectiveUserInput = lastUserMessage.content;
          console.log("使用对话历史中的最后一条用户输入");
        }
      }

      console.log(
        "当前用户输入:",
        effectiveUserInput.substring(0, 50) +
          (effectiveUserInput.length > 50 ? "..." : "")
      );

      // 构建文件内容字符串
      let fileContentsString = "";
      if (relevantFiles.length > 0) {
        fileContentsString = "相关文件内容:\n\n";

        for (const path of relevantFiles) {
          const entry = currentScan?.entries.find(
            (e) => e.path === path && e.type === "file"
          );
          if (entry && entry.content) {
            // 查找该文件中的函数和方法信息
            const functions = currentScan?.codeStructure?.functions?.filter(
              (func) => func.filePath === path
            );

            // 如果有函数信息，添加到文件内容中
            let enhancedContent = entry.content;
            if (functions && functions.length > 0) {
              enhancedContent = `/* 文件中的函数和方法:
${functions
  .map((func) => `${func.type}: ${func.name} [行 ${func.lines.join("-")}]`)
  .join("\n")}
*/\n\n${entry.content}`;
            }

            // 限制文件内容长度
            const truncatedContent =
              enhancedContent.length > 3000
                ? enhancedContent.substring(0, 3000) + "..."
                : enhancedContent;

            // 添加行号到每行，但跳过函数信息注释
            const contentWithLineNumbers = (() => {
              const lines = truncatedContent.split("\n");

              // 检查是否包含函数信息注释
              const hasFunctionInfo =
                lines.length > 2 &&
                lines[0].includes("文件中的函数和方法:") &&
                lines[0].startsWith("/*");

              // 找到实际内容的起始行
              let startIndex = 0;
              if (hasFunctionInfo) {
                // 查找注释结束位置
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes("*/")) {
                    // 注释结束行的下一行才是实际内容
                    startIndex = i + 1;
                    // 如果下一行是空行，再跳过一行
                    if (
                      startIndex < lines.length &&
                      !lines[startIndex].trim()
                    ) {
                      startIndex++;
                    }
                    break;
                  }
                }
              }

              // 只给实际内容添加行号
              return lines
                .map((line, index) => {
                  // 如果是函数信息注释部分，不添加行号
                  if (index < startIndex) {
                    return line;
                  }
                  // 对实际内容添加行号，行号从1开始
                  return `${index - startIndex + 1} ${line}`;
                })
                .join("\n");
            })();

            fileContentsString += `文件: ${path}\n\`\`\`\n${contentWithLineNumbers}\n\`\`\`\n\n`;
          }
        }
      }

      // 构建系统提示词，每次对话都重新构建
      const systemPrompt = getLocalizedPrompt(
        `你是一个强大的AI代码智能体，能够帮助用户修改、删除和创建文件。你可以直接操作用户的代码库，并具有高级编程理解能力。

## 智能体协作模式
你现在处于协作模式，这意味着：
1. **任务导向**：你需要专注于完成用户给定的任务
2. **分步执行**：将复杂任务分解为多个步骤，每步都等待用户确认
3. **清晰沟通**：明确说明当前进度和下一步计划
4. **用户控制**：每一步都需要用户决定是否继续

## 任务状态管理
你需要在每次回复中明确标识当前的任务状态：

\`\`\`task-status
status: planning|executing|completed
code: 要改动的完整、真实代码（禁止伪代码、占位符或省略号）
progress: 当前进度描述
next_action: 下一步行动计划（如果有的话）
\`\`\`

- **planning**: 正在分析任务和制定计划
- **executing**: 正在执行具体的操作
- **completed**: 任务已完成
- **code**: 要改动的完整、可编译代码（必须包含，禁止伪代码、占位符或省略号）

## 协作机制
在每轮对话中，你应该：
1. 明确说明当前完成了什么
2. 如果任务未完成，在 next_action 中描述建议的下一步行动
3. 等待用户决定是否继续执行下一步
4. 只有当任务真正完成时，才将状态设为 completed

请特别注意：
1. 请记住完整的对话历史，理解用户的问题可能是对之前对话的延续。
2. 如果用户提供简短回复（如"是的"、"好的"、"明天呢"），应理解为对之前对话的回应或延续。
3. 只有当用户明确提出新问题或改变话题时，才切换到新话题。
4. 当用户提出非代码相关的问题，请自然地回答，不要强行引导回代码话题。
5. 避免在每次回复中都询问是否需要帮助编写代码。

## 编程能力增强指南
1. **代码理解与分析**：
   - 主动分析代码结构、设计模式和架构
   - 识别潜在的代码问题、性能瓶颈和安全漏洞
   - 理解不同编程语言的特性和最佳实践

2. **智能代码生成**：
   - 生成符合项目风格和约定的代码
   - 自动添加适当的注释和文档
   - 考虑边界情况和异常处理
   - 遵循SOLID、DRY等编程原则

3. **上下文感知**：
   - 记住并理解之前的对话内容和代码修改
   - 基于项目的整体结构提供建议
   - 考虑代码修改的连锁反应和依赖关系

4. **主动建议**：
   - 提供代码优化和重构建议
   - 推荐更现代、更高效的实现方式
   - 建议添加测试以确保代码质量

## 文件操作指南
当需要修改文件时，你应该：
1. 明确指出要修改的文件路径
2. 指定要修改的行号范围（起始行到结束行）
3. 提供新的内容
4. 解释修改的目的和影响

当需要删除文件时，你应该：
1. 明确指出要删除的文件路径
2. 解释为什么需要删除该文件
3. 评估删除可能带来的影响

当需要创建文件时，你应该：
1. 明确指出要创建的文件路径
2. 提供完整的文件内容
3. 解释文件的用途和它如何与项目其他部分集成

## 文件操作格式
你的回复应该使用以下格式来表示文件操作：

对于修改文件：
\`\`\`file-operation
type: modify
path: 文件路径
startLine: 起始行号
endLine: 结束行号
content:
新的内容
\`\`\`

对于删除文件：
\`\`\`file-operation
type: delete
path: 文件路径
\`\`\`

对于创建文件：
\`\`\`file-operation
type: create
path: 文件路径
content:
文件内容
\`\`\`

每次操作都需要用户确认后才能执行。请确保你的操作是安全的，并且不会破坏用户的代码库。`,
        `You are a powerful AI code agent that can help users modify, delete, and create files. You can directly operate on the user's codebase with advanced programming understanding.

## Intelligent Agent Collaboration Mode
You are now in collaboration mode, which means:
1. **Task-Oriented**: Focus on completing the user's given task
2. **Step-by-Step Execution**: Break complex tasks into multiple steps, waiting for user confirmation at each step
3. **Clear Communication**: Clearly explain current progress and next step plans
4. **User Control**: Each step requires user decision to continue

## Task Status Management
You need to clearly identify the current task status in each response:

\`\`\`task-status
status: planning|executing|completed
code: exact compilable code changes (NO pseudocode, placeholders or ellipses)
progress: Current progress description
next_action: Next action plan (if applicable)
\`\`\`

- **planning**: Analyzing task and formulating plan
- **executing**: Performing specific operations
- **completed**: Task completed
- **code**: exact compilable code to be modified (must be included, NO pseudocode, placeholders or ellipses)

## Collaboration Mechanism
In each round of conversation, you should:
1. Clearly explain what has been completed
2. If the task is not finished, describe the suggested next action in next_action
3. Wait for user decision on whether to continue to the next step
4. Only set status to completed when the task is truly finished

Please pay special attention:
1. Remember the complete conversation history and understand that the user's question may be a continuation of the previous conversation.
2. If the user provides a short reply (such as "yes", "okay", "tomorrow?"), interpret it as a response to or continuation of the previous conversation.
3. Only switch to a new topic when the user clearly asks a new question or changes the topic.
4. When users ask non-code related questions, answer naturally without forcing the conversation back to code topics.
5. Avoid asking in every reply whether the user needs help writing code.

## Enhanced Programming Capabilities
1. **Code Understanding & Analysis**:
   - Actively analyze code structure, design patterns, and architecture
   - Identify potential code issues, performance bottlenecks, and security vulnerabilities
   - Understand features and best practices of different programming languages

2. **Intelligent Code Generation**:
   - Generate code that matches project style and conventions
   - Automatically add appropriate comments and documentation
   - Consider edge cases and exception handling
   - Follow SOLID, DRY, and other programming principles

3. **Context Awareness**:
   - Remember and understand previous conversation content and code modifications
   - Provide suggestions based on the overall project structure
   - Consider the ripple effects and dependencies of code changes

4. **Proactive Suggestions**:
   - Offer code optimization and refactoring suggestions
   - Recommend more modern and efficient implementation approaches
   - Suggest adding tests to ensure code quality

## File Operation Guidelines
When you need to modify a file, you should:
1. Clearly indicate the file path to be modified
2. Specify the line number range to be modified (start line to end line)
3. Provide the new content
4. Explain the purpose and impact of the modification

When you need to delete a file, you should:
1. Clearly indicate the file path to be deleted
2. Explain why the file needs to be deleted
3. Assess the potential impact of the deletion

When you need to create a file, you should:
1. Clearly indicate the file path to be created
2. Provide the complete file content
3. Explain the purpose of the file and how it integrates with other parts of the project

## File Operation Format
Your response should use the following format to represent file operations:

For modifying files:
\`\`\`file-operation
type: modify
path: file_path
startLine: start_line_number
endLine: end_line_number
content:
new_content
\`\`\`

For deleting files:
\`\`\`file-operation
type: delete
path: file_path
\`\`\`

For creating files:
\`\`\`file-operation
type: create
path: file_path
content:
file_content
\`\`\`

Each operation needs to be confirmed by the user before execution. Please ensure that your operations are safe and will not damage the user's codebase.`
      );

      // 保留完整的对话历史，不再限制长度
      // 只有在对话历史过长时才进行裁剪，避免超出模型的上下文窗口
      const maxTokenEstimate = 12000; // 估计的最大token数
      let limitedHistory = [...conversationHistory];

      // 估算当前历史的token数
      const estimateTokens = (msgs: typeof limitedHistory): number => {
        // 粗略估计：每个英文单词约1.3个token，每个中文字符约2个token
        let total = 0;
        for (const msg of msgs) {
          const contentLength = msg.content.length;
          const englishWords = msg.content.match(/[a-zA-Z]+/g) || [];
          const englishWordCount = englishWords.length;
          const nonEnglishCharCount = contentLength - englishWordCount;
          total += englishWordCount * 1.3 + nonEnglishCharCount * 2;
        }
        return total;
      };

      // 如果估计的token数超过限制，则裁剪历史
      if (estimateTokens(limitedHistory) > maxTokenEstimate) {
        // 保留系统提示和最近的对话
        const systemMessages = limitedHistory.filter(
          (msg) => msg.role === "system"
        );

        // 从最新的消息开始，尽可能多地保留对话
        const recentMessages: typeof limitedHistory = [];
        let tokenCount = 0;

        for (let i = limitedHistory.length - 1; i >= 0; i--) {
          const msg = limitedHistory[i];
          if (msg.role !== "system") {
            const msgTokens = estimateTokens([msg]);
            if (tokenCount + msgTokens <= maxTokenEstimate * 0.7) {
              // 留30%给系统提示和新内容
              recentMessages.unshift(msg);
              tokenCount += msgTokens;
            } else {
              break;
            }
          }
        }

        limitedHistory = [...systemMessages, ...recentMessages];
      }

      // 构建新的对话历史，使用新的系统提示
      const newHistory = [
        { role: "system", content: systemPrompt },
        ...limitedHistory.filter((msg) => msg.role !== "system"),
      ];

      // 确保对话历史中包含当前有效的用户输入
      const lastUserMessage = newHistory
        .filter((msg) => msg.role === "user")
        .pop();

      // 检查最后一个用户消息是否与当前有效的用户输入匹配
      const hasEffectiveUserInput =
        lastUserMessage && lastUserMessage.content.includes(effectiveUserInput);

      // 如果没有当前有效的用户输入，添加到历史
      if (effectiveUserInput && !hasEffectiveUserInput) {
        console.log(
          "添加有效的用户输入到对话历史:",
          effectiveUserInput.substring(0, 30) + "..."
        );
        newHistory.push({ role: "user", content: effectiveUserInput });
      }

      // 如果有文件内容，添加到最后一个用户消息
      if (fileContentsString && newHistory.length > 1) {
        const lastUserIndex = newHistory
          .map((msg) => msg.role)
          .lastIndexOf("user");
        if (lastUserIndex !== -1) {
          // 确保最后一个用户消息包含当前有效的用户输入
          const lastUserContent = newHistory[lastUserIndex].content;
          if (!lastUserContent.includes(effectiveUserInput)) {
            console.log(
              "最后一个用户消息不包含当前有效的用户输入，添加有效输入"
            );
            newHistory[lastUserIndex] = {
              role: "user",
              content: effectiveUserInput + "\n\n" + fileContentsString,
            };
          } else {
            console.log(
              "最后一个用户消息已包含当前有效的用户输入，添加文件内容"
            );
            newHistory[lastUserIndex] = {
              role: "user",
              content: lastUserContent + "\n\n" + fileContentsString,
            };
          }
        }
      }

      console.log(
        "对话历史:",
        newHistory.map((msg) => ({
          role: msg.role,
          contentLength: msg.content.length,
        }))
      );

      // 获取AI响应
      let response = "";
      await chatCompletion(newHistory, {
        model: modelToUse, // <<<<<< 根据阶段选择模型
        stream: true,
        onUpdate: (chunk) => {
          response += chunk;
          // 确保更新到正确的轮次
          setResponseSegments((prev) => ({
            ...prev,
            [roundIndex]: (prev[roundIndex] || "") + chunk,
          }));
          setCurrentResponse(response);

          // 实时更新对话轮次中的AI回复
          setDialogRounds((prev) => {
            const updated = [...prev];
            if (updated[roundIndex]) {
              updated[roundIndex] = {
                ...updated[roundIndex],
                aiResponse: response,
                modelUsed: modelToUse, // 记录模型
              };
            }
            return updated;
          });
        },
      });

      // ===== 解析文件操作（无论什么阶段都解析） =====
      const taskStatusInfo = parseTaskStatus(response);
      setTaskStatus(taskStatusInfo.status);

      let fileOperations: FileOperation[] = parseFileOperations(response);
      if (taskStatusInfo.status === "executing" && fileOperations.length) {
        setPendingOperations((prev) => [...prev, ...fileOperations]);
      }

      // 根据任务状态设置完成状态
      if (taskStatusInfo.status === "completed") {
        setIsComplete(true);
      } else {
        setIsComplete(false);
      }

      // 更新对话轮次
      setDialogRounds((prev) => {
        const updated = [...prev];
        updated[roundIndex] = {
          ...updated[roundIndex],
          aiResponse: response,
          fileOperations: fileOperations,
          modelUsed: modelToUse, // 记录模型
        };
        return updated;
      });

      // 添加到对话历史，确保不重复添加
      setConversationHistory((prev) => {
        // 检查最后一条消息是否已经是AI响应
        const lastMessage = prev[prev.length - 1];
        const isLastMessageFromAI =
          lastMessage && lastMessage.role === "assistant";

        // 如果最后一条消息不是AI响应，或者内容与当前响应不同，则添加新的AI响应
        if (!isLastMessageFromAI || lastMessage.content !== response) {
          console.log("添加新的AI响应到对话历史");
          return [...prev, { role: "assistant", content: response }];
        } else {
          console.log("AI响应已存在于对话历史中，不重复添加");
          return prev;
        }
      });

      // 不再自动执行，每轮都等待用户决定
      // 只有当任务状态为completed时才设置为完成
      if (taskStatusInfo.status === "completed") {
        setIsComplete(true);
      } else {
        setIsComplete(false);
        // 显示继续按钮，让用户决定是否继续
      }

      console.log(
        "对话处理完成 - 任务状态:",
        taskStatusInfo.status,
        "是否完成:",
        taskStatusInfo.status === "completed"
      );
    } catch (error) {
      console.error("对话继续错误:", error);
      // 发生错误时也要重置状态
      setIsComplete(false);
    } finally {
      // 确保处理完成后重置测试状态，允许用户继续输入
      setIsTesting(false);
      console.log("对话状态已重置 - 可以继续输入");
    }
  };

  // 渲染对话内容
  const renderDialogContent = () => {
    return (
      <div className="flex flex-col space-y-4 mb-4">
        {dialogRounds.map((round, index) => (
          <div key={index} className="flex flex-col space-y-2">
            {/* 用户输入 - 只有当hideUserInput为false或未定义时才显示 */}
            {!round.hideUserInput && (
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white mr-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
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
                  <div className="font-medium text-blue-700 dark:text-blue-300">
                    {t("aiagent.user")}
                  </div>
                </div>
                <div className="text-gray-700 dark:text-gray-200 ml-10">
                  {round.userInput}
                </div>
              </div>
            )}

            {/* AI响应 */}
            <div
              ref={index === currentRound - 1 ? currentRoundRef : undefined}
              className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg"
            >
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white mr-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L4 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.733.99A1.002 1.002 0 0118 6v2a1 1 0 11-2 0v-.277l-.254.145a1 1 0 11-.992-1.736l.23-.132-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.58V12a1 1 0 11-2 0v-1.42l-1.246-.712a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.42l1.246.712a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.42V12a1 1 0 011-1zm-9.618 5.504a1 1 0 011.364-.372l.254.145V16a1 1 0 112 0v.277l.254-.145a1 1 0 11.992 1.736l-1.735.992a.995.995 0 01-1.022 0l-1.735-.992a1 1 0 01-.372-1.364z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div
                  className="font-medium text-purple-700 dark:text-purple-300"
                  style={{ opacity: 0.85 }}
                >
                  {round.modelUsed === PLANNING_MODEL
                    ? "o3"
                    : round.modelUsed === EXECUTION_MODEL
                    ? "gpt4.1"
                    : t("aiagent.agent")}
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-200 ml-10 prose dark:prose-invert max-w-none">
                {index === currentRound - 1 && isTesting ? (
                  // 正在生成的响应
                  <>
                    <Markdown
                      options={{
                        overrides: {
                          pre: {
                            component: ({ children, ...props }) => {
                              return <div {...props}>{children}</div>;
                            },
                          },
                          code: {
                            component: CodeBlock,
                          },
                        },
                      }}
                    >
                      {responseSegments[index] || ""}
                    </Markdown>
                    <div className="flex items-center mt-2 text-gray-500 dark:text-gray-400">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-2"></div>
                      {t("aiagent.thinking")}{" "}
                      {estimatedTime &&
                        `(${t("aiagent.eta", {
                          seconds: String(estimatedTime),
                        })})`}
                    </div>
                  </>
                ) : (
                  // 已完成的响应
                  <Markdown
                    options={{
                      overrides: {
                        pre: {
                          component: ({ children, ...props }) => {
                            return <div {...props}>{children}</div>;
                          },
                        },
                        code: {
                          component: CodeBlock,
                        },
                      },
                    }}
                  >
                    {round.aiResponse || ""}
                  </Markdown>
                )}
              </div>

              {/* 文件操作列表 */}
              {round.fileOperations && round.fileOperations.length > 0 && (
                <div className="mt-4 ml-10">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("aiagent.fileOperations")}:
                  </div>
                  <div className="space-y-2">
                    {round.fileOperations.map((operation, opIndex) => (
                      <div
                        key={opIndex}
                        className="bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 text-sm"
                      >
                        <div className="flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-4 w-4 mr-2 ${
                              operation.type === FileOperationType.MODIFY
                                ? "text-yellow-500"
                                : operation.type === FileOperationType.DELETE
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            {operation.type === FileOperationType.MODIFY ? (
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            ) : operation.type === FileOperationType.DELETE ? (
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            ) : (
                              <path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM8 7a2 2 0 100-4 2 2 0 000 4zm.256 7a4.474 4.474 0 01-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256z" />
                            )}
                          </svg>
                          <span className="font-medium">
                            {operation.type === FileOperationType.MODIFY
                              ? t("aiagent.modifyFile")
                              : operation.type === FileOperationType.DELETE
                              ? t("aiagent.deleteFile")
                              : t("aiagent.createFile")}
                          </span>
                          <span className="ml-2 text-gray-600 dark:text-gray-400">
                            {operation.path}
                          </span>
                          {operation.type === FileOperationType.MODIFY && (
                            <span className="ml-2 text-gray-500 dark:text-gray-400 text-xs">
                              ({t("aiagent.lines")} {operation.startLine}-
                              {operation.endLine})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染权限请求UI
  const renderPermissionRequest = () => {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md mx-auto">
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-yellow-500"
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
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {t("aiagent.permissionTitle")}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
          {t("aiagent.permissionDescription")}
        </p>
        <div className="space-y-3 mb-6 w-full">
          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                {t("aiagent.permissionWarning")}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                {t("aiagent.indexingReminder")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t("aiagent.cancel")}
          </button>
          <button
            onClick={handlePermissionRequest}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            {t("aiagent.grantPermission")}
          </button>
        </div>
      </div>
    );
  };

  // 渲染待处理操作UI
  const renderPendingOperations = () => {
    if (pendingOperations.length === 0) {
      return null;
    }

    return (
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
            {t("aiagent.pendingOperations")} ({pendingOperations.length})
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={handleApplyAllOperations}
              disabled={processingOperation}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {processingOperation ? "应用中..." : "一键全部应用"}
            </button>
            <button
              onClick={() => setPendingOperations([])}
              disabled={processingOperation}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              全部拒绝
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {pendingOperations.map((operation, index) => (
            <FileOperationCard
              key={index}
              operation={operation}
              onApprove={() => handleFileOperation(operation)}
              onReject={() => {
                setPendingOperations((prev) =>
                  prev.filter((op) => op !== operation)
                );
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // ========= handleContinueTask 定义之后新增 =========
  useEffect(() => {
    if (
      hasPermission &&
      autoMode &&
      !isTesting &&
      !isIndexing &&
      !processingOperation &&
      pendingOperations.length === 0 &&
      taskStatus !== "completed"
    ) {
      handleContinueTask(); // 自动进入下一轮
    }
  }, [
    hasPermission,
    autoMode,
    isTesting,
    isIndexing,
    processingOperation,
    pendingOperations.length,
    taskStatus,
  ]);
  // ========= 自动续步 effect 结束 =========

  // ========= 自动应用操作 effect =========
  useEffect(() => {
    if (
      autoMode &&
      taskStatus === "executing" &&
      pendingOperations.length > 0 &&
      !processingOperation
    ) {
      handleApplyAllOperations();
    }
  }, [autoMode, taskStatus, pendingOperations.length, processingOperation]);
  // ========= 自动应用操作 effect 结束 =========

  // 主组件渲染
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L4 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.733.99A1.002 1.002 0 0118 6v2a1 1 0 11-2 0v-.277l-.254.145a1 1 0 11-.992-1.736l.23-.132-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.58V12a1 1 0 11-2 0v-1.42l-1.246-.712a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.42l1.246.712a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.42V12a1 1 0 011-1zm-9.618 5.504a1 1 0 011.364-.372l.254.145V16a1 1 0 112 0v.277l.254-.145a1 1 0 11.992 1.736l-1.735.992a.995.995 0 01-1.022 0l-1.735-.992a1 1 0 01-.372-1.364z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {t("aiagent.title")}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            {/* 自动模式开关 */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("aiagent.autoMode")}
              </span>
              <button
                onClick={() => setAutoMode(!autoMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoMode ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* 任务状态指示器 */}
            {hasPermission && (
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    taskStatus === "completed"
                      ? "bg-green-500"
                      : taskStatus === "executing"
                      ? "bg-blue-500 animate-pulse"
                      : taskStatus === "planning"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-gray-400"
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {taskStatus === "completed"
                    ? t("aiagent.taskCompleted")
                    : taskStatus === "executing"
                    ? t("aiagent.taskExecuting")
                    : taskStatus === "planning"
                    ? t("aiagent.taskPlanning")
                    : t("aiagent.taskWaiting")}
                </span>
                {/* 任务进行状态 */}
                {taskStatus === "executing" && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                    执行中
                  </span>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

        {/* 内容区域 */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-4"
          style={{ scrollBehavior: "smooth" }}
        >
          {!hasPermission ? (
            // 权限请求UI
            renderPermissionRequest()
          ) : (
            // 对话内容
            <>
              {renderDialogContent()}
              {renderPendingOperations()}

              {/* 加载中状态 */}
              {isIndexing && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce mr-2"></div>
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full animate-bounce mr-2"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {t("aiagent.indexing")}
                  </span>
                </div>
              )}

              {/* 处理操作中状态 */}
              {processingOperation && (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {t("aiagent.processing")}
                  </span>
                </div>
              )}

              {/* 完成状态 */}
              {isComplete && (
                <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg mt-4">
                  <div className="flex items-center text-green-700 dark:text-green-300">
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
                    {t("aiagent.complete")}
                  </div>
                </div>
              )}

              {/* 继续任务和执行按钮 */}
              {!isComplete && !isTesting && taskStatus !== "completed" && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleExecuteNow}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center space-x-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{t("aiagent.execute")}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 输入框区域 - 仅在有权限且不在处理中时显示 */}
        {hasPermission && !isIndexing && !processingOperation && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  t("aiagent.inputPlaceholder") || "输入您的问题或指令..."
                }
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                rows={3}
                disabled={isTesting || isSubmitting}
              />
              <button
                onClick={handleSubmit}
                disabled={isTesting || isSubmitting || !userInput.trim()}
                className={`absolute right-3 bottom-3 p-2 rounded-full ${
                  isTesting || isSubmitting || !userInput.trim()
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                } transition-colors`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            {isTesting && (
              <div className="flex items-center justify-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                {t("aiagent.thinking")}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
