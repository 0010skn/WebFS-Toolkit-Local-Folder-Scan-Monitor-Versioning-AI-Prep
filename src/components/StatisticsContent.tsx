"use client";

import { useState, useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import { directoryHandleAtom, themeAtom } from "../lib/store";
import { isTextFile, getFileExtension } from "../lib/utils";
import { parseComments } from "../lib/commentParser";
import { useTranslations } from "./LocaleProvider";
import { CodeStructure, parseCodeStructures } from "../lib/codeStructureParser";
import {
  CodeStructureVisualizer,
  CodeStructureStats,
} from "./CodeStructureVisualizer";
import ProjectConfigVisualizer from "./ProjectConfigVisualizer";
import ProjectAnalysisChart from "./ProjectAnalysisChart";

// 代码文件类型
const CODE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".rs",
  ".vue",
];

// 统计数据类型
interface StatisticsData {
  totalFiles: number;
  codeFiles: number;
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  extensionStats: Record<
    string,
    {
      files: number;
      lines: number;
      codeLines: number;
      commentLines: number;
      blankLines: number;
    }
  >;
}

// 注释类型
interface Comment {
  text: string;
  file: string;
  line: number;
  isBlock: boolean;
  contextCode: string[]; // 注释周围的代码
  contextLineStart: number; // 上下文代码的起始行号
}

// 声明 FileSystemEntry 类型，确保与ProjectConfigVisualizer组件中的定义一致
interface FileSystemEntry {
  name: string;
  kind: "file" | "directory";
  path: string;
  lastModified?: number;
  size?: number;
  content?: string;
}

export default function StatisticsContent() {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showCodeStructure, setShowCodeStructure] = useState(false);
  const [showProjectConfig, setShowProjectConfig] = useState(false);
  const [showProjectAnalysis, setShowProjectAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeStructures, setCodeStructures] = useState<CodeStructure[]>([]);
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [theme] = useAtom(themeAtom);
  const [commentSearchQuery, setCommentSearchQuery] = useState<string>("");
  const [expandedComments, setExpandedComments] = useState<
    Record<number, boolean>
  >({});

  // 过滤注释
  const filteredComments = useMemo(() => {
    if (!commentSearchQuery || !comments.length) return comments;

    const query = commentSearchQuery.toLowerCase();
    return comments.filter(
      (comment) =>
        comment.text.toLowerCase().includes(query) ||
        comment.file.toLowerCase().includes(query)
    );
  }, [comments, commentSearchQuery]);

  // 切换注释上下文显示
  const toggleCommentContext = (index: number) => {
    setExpandedComments((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // 扫描并统计项目
  const scanProject = async () => {
    if (!directoryHandle) {
      setError("请先选择一个项目文件夹");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const stats: StatisticsData = {
        totalFiles: 0,
        codeFiles: 0,
        totalLines: 0,
        codeLines: 0,
        blankLines: 0,
        commentLines: 0,
        extensionStats: {},
      };

      const allComments: Comment[] = [];
      const structures: CodeStructure[] = [];
      const allEntries: FileSystemEntry[] = [];

      // 递归扫描文件夹
      await scanDirectory(
        directoryHandle,
        "",
        stats,
        allComments,
        structures,
        allEntries
      );

      setStatistics(stats);
      setComments(allComments);
      setCodeStructures(structures);
      setEntries(allEntries);

      // 重置显示状态
      setShowComments(false);
      setShowCodeStructure(false);
      setShowProjectConfig(false);
      setShowProjectAnalysis(false);
    } catch (err) {
      console.error("统计过程中出错:", err);
      setError(
        `统计过程中出错: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 递归扫描目录
  const scanDirectory = async (
    dirHandle: FileSystemDirectoryHandle,
    path: string,
    stats: StatisticsData,
    comments: Comment[],
    structures: CodeStructure[],
    allEntries: FileSystemEntry[]
  ) => {
    try {
      // 检查 .gitignore
      const gitignorePatterns: string[] = [];
      try {
        const gitignoreFile = await dirHandle.getFileHandle(".gitignore", {
          create: false,
        });
        const file = await gitignoreFile.getFile();
        const content = await file.text();
        gitignorePatterns.push(
          ...content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"))
        );
      } catch (err) {
        // .gitignore 文件不存在，忽略错误
      }

      // 忽略 .git 和 node_modules 文件夹
      const ignoreDirs = [
        ".git",
        "node_modules",
        ".next",
        "build",
        "dist",
        "out",
      ];

      // 遍历目录中的所有文件和子目录
      for await (const [name, handle] of dirHandle.entries()) {
        const filePath = path ? `${path}/${name}` : name;

        // 检查是否应该忽略
        const shouldIgnore =
          ignoreDirs.includes(name) ||
          gitignorePatterns.some((pattern) => {
            if (pattern.startsWith("/") && !pattern.endsWith("/")) {
              // 路径匹配
              return filePath === pattern.substring(1);
            } else if (pattern.endsWith("/")) {
              // 目录匹配
              return filePath.startsWith(pattern);
            } else {
              // 通配符匹配 (简化版，实际 .gitignore 逻辑更复杂)
              return filePath.includes(pattern);
            }
          });

        if (shouldIgnore) continue;

        if (handle.kind === "directory") {
          // 添加目录条目
          const dirEntry: FileSystemEntry = {
            name,
            path: filePath,
            kind: "directory",
          };
          allEntries.push(dirEntry);

          // 递归扫描子目录
          await scanDirectory(
            handle as FileSystemDirectoryHandle,
            filePath,
            stats,
            comments,
            structures,
            allEntries
          );
        } else if (handle.kind === "file") {
          stats.totalFiles++;

          // 获取文件内容
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const extension = getFileExtension(name).toLowerCase();

          // 添加文件条目
          const fileEntry: FileSystemEntry = {
            name,
            path: filePath,
            kind: "file",
            lastModified: file.lastModified,
            size: file.size,
          };

          // 检查是否为代码文件
          if (CODE_EXTENSIONS.includes(extension) && isTextFile(name)) {
            stats.codeFiles++;

            // 初始化该扩展名的统计数据
            if (!stats.extensionStats[extension]) {
              stats.extensionStats[extension] = {
                files: 0,
                lines: 0,
                codeLines: 0,
                commentLines: 0,
                blankLines: 0,
              };
            }

            stats.extensionStats[extension].files++;

            try {
              const content = await file.text();

              // 保存文件内容
              fileEntry.content = content;

              // 尝试解析代码结构
              if (
                [
                  ".ts",
                  ".tsx",
                  ".js",
                  ".jsx",
                  ".java",
                  ".cs",
                  ".cpp",
                  ".py",
                  ".go",
                  ".php",
                  ".rb",
                  ".rs",
                ].includes(extension)
              ) {
                try {
                  const fileStructures = parseCodeStructures(
                    content,
                    name,
                    filePath
                  );
                  structures.push(...fileStructures);
                } catch (structErr) {
                  console.warn(`解析文件结构失败: ${filePath}`, structErr);
                }
              }

              const lines = content.split("\n");

              // 统计行数
              stats.totalLines += lines.length;
              stats.extensionStats[extension].lines += lines.length;

              // 分析每一行
              let inBlockComment = false;

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (!line) {
                  // 空行
                  stats.blankLines++;
                  stats.extensionStats[extension].blankLines++;
                } else {
                  // 处理注释
                  const {
                    isComment,
                    isStartBlockComment,
                    isEndBlockComment,
                    commentText,
                  } = parseComments(line, extension, inBlockComment);

                  if (isStartBlockComment && !isEndBlockComment) {
                    inBlockComment = true;
                  }

                  if (isEndBlockComment) {
                    inBlockComment = false;
                  }

                  if (isComment || inBlockComment) {
                    stats.commentLines++;
                    stats.extensionStats[extension].commentLines++;

                    // 保存有效注释内容
                    if (commentText && commentText.trim()) {
                      // 提取上下文代码（注释前后各3行）
                      const contextStart = Math.max(0, i - 3);
                      const contextEnd = Math.min(lines.length - 1, i + 3);
                      const contextCode = lines.slice(
                        contextStart,
                        contextEnd + 1
                      );

                      comments.push({
                        text: commentText.trim(),
                        file: filePath,
                        line: i + 1,
                        isBlock: inBlockComment || isStartBlockComment,
                        contextCode,
                        contextLineStart: contextStart + 1,
                      });
                    }
                  } else {
                    // 代码行
                    stats.codeLines++;
                    stats.extensionStats[extension].codeLines++;
                  }
                }
              }
            } catch (err) {
              console.warn(`无法读取文件内容: ${filePath}`, err);
            }
          } else {
            // 对于非代码文件，尝试读取内容（针对配置文件）
            if (
              name.includes("config") ||
              name.endsWith(".json") ||
              name.startsWith(".")
            ) {
              try {
                fileEntry.content = await file.text();
              } catch (err) {
                console.warn(`无法读取非代码文件内容: ${filePath}`, err);
              }
            }
          }

          allEntries.push(fileEntry);
        }
      }
    } catch (err) {
      console.error(`扫描目录出错: ${path}`, err);
      throw err;
    }
  };

  // 初始加载时自动扫描
  useEffect(() => {
    if (directoryHandle) {
      scanProject();
    }
  }, [directoryHandle]);

  // 如果没有选择目录，显示提示
  if (!directoryHandle) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-gray-600 dark:text-gray-300">
          {t("statistics.noFolder")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200">
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <button
          onClick={scanProject}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-300 disabled:bg-blue-400"
        >
          {isLoading ? t("statistics.scanning") : t("statistics.rescan")}
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          disabled={isLoading || !statistics}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors duration-300 disabled:bg-purple-400"
        >
          {showComments
            ? t("statistics.hideComments")
            : t("statistics.showComments")}
        </button>

        <button
          onClick={() => setShowCodeStructure(!showCodeStructure)}
          disabled={isLoading || !statistics || codeStructures.length === 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors duration-300 disabled:bg-indigo-400"
        >
          {showCodeStructure
            ? t("codeStructure.hide")
            : t("codeStructure.show")}
        </button>

        <button
          onClick={() => setShowProjectConfig(!showProjectConfig)}
          disabled={isLoading || !statistics || entries.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors duration-300 disabled:bg-green-400"
        >
          {showProjectConfig
            ? t("projectConfig.hideConfig")
            : t("projectConfig.showConfig")}
        </button>

        <button
          onClick={() => setShowProjectAnalysis(!showProjectAnalysis)}
          disabled={isLoading || !statistics || codeStructures.length === 0}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors duration-300 disabled:bg-teal-400"
        >
          {showProjectAnalysis
            ? t("codeAnalysis.hideAnalysis")
            : t("codeAnalysis.showAnalysis")}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : statistics ? (
        <div className="space-y-6">
          {/* 总体统计 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">
              {t("statistics.overallStatistics")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300">
                  {t("statistics.fileStatistics")}
                </h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-200">
                  {statistics.codeFiles}
                </p>
                <p className="text-sm text-blue-500 dark:text-blue-400">
                  {t("statistics.codeFiles")} / {statistics.totalFiles}{" "}
                  {t("statistics.totalFiles")}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-green-700 dark:text-green-300">
                  {t("statistics.lineStatistics")}
                </h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-200">
                  {statistics.codeLines}
                </p>
                <p className="text-sm text-green-500 dark:text-green-400">
                  {t("statistics.codeLines")} / {statistics.totalLines}{" "}
                  {t("statistics.totalLines")}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-purple-700 dark:text-purple-300">
                  {t("statistics.commentStatistics")}
                </h3>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-200">
                  {statistics.commentLines}
                </p>
                <p className="text-sm text-purple-500 dark:text-purple-400">
                  {t("statistics.commentStatistics")}（
                  {(
                    (statistics.commentLines /
                      (statistics.codeLines + statistics.commentLines)) *
                    100
                  ).toFixed(1)}
                  %）
                </p>
              </div>
            </div>
          </div>

          {/* 项目代码分析图表 */}
          {entries.length > 0 &&
            codeStructures.length > 0 &&
            showProjectAnalysis && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4 dark:text-white">
                  {t("codeAnalysis.title")}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t("codeAnalysis.description")}. {t("codeAnalysis.dragHelp")}
                </p>
                <ProjectAnalysisChart
                  entries={entries}
                  structures={codeStructures}
                />
              </div>
            )}

          {/* 项目架构图表 */}
          {entries.length > 0 && showProjectConfig && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                {t("projectConfig.title")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t("projectConfig.dragHelp")}
              </p>
              <ProjectConfigVisualizer entries={entries} />
            </div>
          )}

          {/* 代码结构统计 - 始终显示，有数据时 */}
          {codeStructures.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 dark:text-white flex justify-between items-center">
                <span>{t("codeStructure.totalStructures")}</span>
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  {codeStructures.length > 0
                    ? t("codeStructure.count").replace(
                        "{count}",
                        codeStructures.length.toString()
                      )
                    : ""}
                </span>
              </h2>
              <CodeStructureStats
                structures={codeStructures}
                theme={theme as "light" | "dark"}
              />
            </div>
          )}

          {/* 代码结构可视化 - 只在点击按钮后显示 */}
          {codeStructures.length > 0 && showCodeStructure && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                {t("codeStructure.visualization")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t("codeStructure.visualizationHelp")}
              </p>
              <CodeStructureVisualizer
                structures={codeStructures}
                theme={theme as "light" | "dark"}
              />
            </div>
          )}

          {/* 按文件类型统计 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">
              {t("statistics.fileTypeStatistics")}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                      {t("statistics.extension")}
                    </th>
                    <th className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {t("statistics.fileCount")}
                    </th>
                    <th className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {t("statistics.totalLineCount")}
                    </th>
                    <th className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {t("statistics.codeLineCount")}
                    </th>
                    <th className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {t("statistics.commentLineCount")}
                    </th>
                    <th className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {t("statistics.blankLineCount")}
                    </th>
                    <th className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">
                      {t("statistics.commentRatio")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {Object.entries(statistics.extensionStats)
                    .sort((a, b) => b[1].lines - a[1].lines)
                    .map(([ext, data]) => (
                      <tr
                        key={ext}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="py-2 px-4 text-gray-800 dark:text-gray-200">
                          {ext}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-800 dark:text-gray-200">
                          {data.files}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-800 dark:text-gray-200">
                          {data.lines}
                        </td>
                        <td className="py-2 px-4 text-right text-green-600 dark:text-green-400">
                          {data.codeLines}
                        </td>
                        <td className="py-2 px-4 text-right text-purple-600 dark:text-purple-400">
                          {data.commentLines}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400">
                          {data.blankLines}
                        </td>
                        <td className="py-2 px-4 text-right text-blue-600 dark:text-blue-400">
                          {(
                            (data.commentLines /
                              (data.codeLines + data.commentLines)) *
                            100
                          ).toFixed(1)}
                          %
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 注释统计 */}
          {showComments && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                {t("statistics.projectComments")} ({comments.length})
              </h2>
              {comments.length > 0 ? (
                <div className="space-y-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t("statistics.commentsHelp")}
                    </p>
                  </div>

                  {/* 搜索框 */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t("statistics.search_comments")}
                        className="w-full p-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        value={commentSearchQuery || ""}
                        onChange={(e) => setCommentSearchQuery(e.target.value)}
                      />
                      <div className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">
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
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                    {filteredComments.length > 0 ? (
                      filteredComments.map((comment, index) => (
                        <div
                          key={index}
                          className="border rounded-lg overflow-hidden dark:border-gray-700"
                        >
                          {/* 注释元信息 */}
                          <div className="bg-purple-50 dark:bg-purple-900/30 px-4 py-2 border-b dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-purple-600 dark:text-purple-400">
                                {comment.file}:{comment.line}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                                {comment.isBlock
                                  ? t("statistics.blockComment")
                                  : t("statistics.lineComment")}
                              </span>
                            </div>
                            <button
                              onClick={() => toggleCommentContext(index)}
                              className="text-xs px-2 py-1 bg-purple-200 dark:bg-purple-800 rounded hover:bg-purple-300 dark:hover:bg-purple-700 text-purple-800 dark:text-purple-200"
                            >
                              {expandedComments[index]
                                ? t("statistics.hide_context")
                                : t("statistics.show_context")}
                            </button>
                          </div>

                          {/* 注释内容 */}
                          <div className="p-4 bg-white dark:bg-gray-800">
                            <p className="text-gray-800 dark:text-gray-200 font-medium">
                              {comment.text}
                            </p>
                          </div>

                          {/* 代码上下文 */}
                          {expandedComments[index] && comment.contextCode && (
                            <div className="border-t dark:border-gray-700">
                              <pre className="p-4 bg-gray-50 dark:bg-gray-900 text-sm font-mono overflow-x-auto relative">
                                {comment.contextCode.map((line, lineIndex) => {
                                  const currentLineNumber =
                                    (comment.contextLineStart || 1) + lineIndex;
                                  return (
                                    <div
                                      key={lineIndex}
                                      className={`${
                                        comment.line === currentLineNumber
                                          ? "bg-yellow-100 dark:bg-yellow-900/30 -mx-4 px-4"
                                          : ""
                                      }`}
                                    >
                                      <span className="inline-block w-8 text-right mr-4 text-gray-500 select-none">
                                        {currentLineNumber}
                                      </span>
                                      {line}
                                    </div>
                                  );
                                })}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400">
                        {commentSearchQuery
                          ? t("statistics.no_results")
                          : t("statistics.noComments")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  {t("statistics.noComments")}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
          <p className="text-gray-600 dark:text-gray-300">
            {t("statistics.startScan")}
          </p>
        </div>
      )}
    </div>
  );
}
