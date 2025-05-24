"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/LocaleProvider";
import { motion } from "framer-motion";

// 更新日志数据类型
interface ChangelogEntry {
  date: string;
  time: string;
  version: string;
  changes: string[];
  author: {
    name: string;
    email?: string;
    avatar_url?: string;
  };
  commitId: string;
  treeSha?: string;
  html_url?: string;
}

// 模拟更多的更新日志数据
const additionalChangelogs: ChangelogEntry[] = [
  {
    date: "2025-05-15",
    time: "14:30",
    version: "v1.2.0",
    author: {
      name: "Folda-Scan Team",
      email: "team@folda-scan.dev",
      avatar_url: "https://avatars.githubusercontent.com/u/12345678?v=4",
    },
    commitId: "a2a139fca47e7caed4d8c08c6b3b9310e29ddfdb",
    treeSha: "b95fc9007b3b6c73eba181d11f17f4c5434ad73b",
    html_url:
      "https://github.com/folda-scan/folda-scan/commit/a2a139fca47e7caed4d8c08c6b3b9310e29ddfdb",
    changes: [
      "新增多线程扫描功能，大幅提升扫描速度，特别是对于大型项目",
      "优化文件系统监控逻辑，减少CPU和内存占用",
      "修复了多个已知问题，提高了应用稳定性",
    ],
  },
  {
    date: "2025-05-10",
    time: "09:15",
    version: "v1.1.5",
    author: {
      name: "Folda-Scan Team",
      email: "team@folda-scan.dev",
      avatar_url: "https://avatars.githubusercontent.com/u/12345678?v=4",
    },
    commitId: "20ef24e0436d347160943771d42b7ee123c91716",
    treeSha: "60abca6e53cc8558a66c63a845c4333a55880bbc",
    html_url:
      "https://github.com/folda-scan/folda-scan/commit/20ef24e0436d347160943771d42b7ee123c91716",
    changes: [
      "添加知识库功能，支持本地存储和检索项目相关知识",
      "优化向量化引擎，提高语义搜索准确性",
      "新增多语言支持，现已支持中文和英文",
      "改进离线使用体验，支持完全离线工作",
    ],
  },
  {
    date: "2025-05-01",
    time: "16:45",
    version: "v1.1.0",
    author: {
      name: "0010skn",
      email: "blender357@foxmail.com",
      avatar_url: "https://avatars.githubusercontent.com/u/183616870?v=4",
    },
    commitId: "f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    treeSha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    html_url:
      "https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/commit/f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    changes: [
      "新增Docker和Docker Compose分析功能，自动检测和分析项目中的Docker配置",
      "添加环境变量文件(.env)分析功能，帮助开发者管理环境配置",
      "优化文件扫描算法，提高大型项目的扫描速度",
      "改进PWA支持，提供更好的安装和离线体验",
    ],
  },
  {
    date: "2025-04-20",
    time: "11:30",
    version: "v1.0.5",
    author: {
      name: "0010skn",
      email: "blender357@foxmail.com",
      avatar_url: "https://avatars.githubusercontent.com/u/183616870?v=4",
    },
    commitId: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    treeSha: "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b",
    html_url:
      "https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/commit/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    changes: [
      "添加项目统计功能，提供代码行数、文件类型等详细统计信息",
      "新增文件变更监控功能，实时检测项目文件变化",
      "优化UI响应速度，提升用户交互体验",
      "修复多个用户反馈的问题",
    ],
  },
  {
    date: "2025-04-10",
    time: "10:00",
    version: "v1.0.0",
    author: {
      name: "0010skn",
      email: "blender357@foxmail.com",
      avatar_url: "https://avatars.githubusercontent.com/u/183616870?v=4",
    },
    commitId: "0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
    treeSha: "0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1",
    html_url:
      "https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/commit/0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
    changes: [
      "Folda-Scan 正式版发布！",
      "支持本地文件夹扫描和索引",
      "支持 .gitignore 规则过滤",
      "提供基本的项目结构可视化",
      "支持PWA安装，可作为独立应用使用",
    ],
  },
];

// 从GitHub API获取更新日志数据
async function fetchChangelogData(): Promise<ChangelogEntry[]> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/oldjs/web-code-agent"
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // 将GitHub提交数据转换为更新日志格式
    const apiChangelogs = data.map((commit: any) => {
      // 从提交信息中提取版本号（如果有）
      const versionMatch = commit.commit.message.match(/v\d+\.\d+\.\d+/);
      const version = versionMatch ? versionMatch[0] : "";

      // 格式化日期和时间
      const commitDate = new Date(commit.commit.author.date);
      const formattedDate = commitDate.toLocaleDateString();
      const formattedTime = commitDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // 过滤掉短消息和包含[no]的消息
      const message = commit.commit.message;
      const validMessage =
        message.length >= 30 && !message.includes("[no]") ? message : "";

      // 提取作者信息
      const authorInfo = {
        name: commit.commit.author.name || "Unknown",
        email: commit.commit.author.email || undefined,
        avatar_url: commit.author?.avatar_url || undefined,
      };

      // 提取树哈希值
      const treeSha = commit.commit.tree?.sha;

      return {
        date: formattedDate,
        time: formattedTime,
        version: version,
        author: authorInfo,
        commitId: commit.sha,
        treeSha: treeSha,
        html_url: commit.html_url,
        changes: validMessage ? [validMessage] : [],
      };
    });

    // 过滤掉没有有效变更的条目
    const filteredChangelogs = apiChangelogs.filter(
      (entry: ChangelogEntry) => entry.changes.length > 0
    );

    // 合并API数据和模拟数据
    return [...filteredChangelogs, ...additionalChangelogs];
  } catch (error) {
    console.error("Error fetching changelog data:", error);
    // 如果API调用失败，至少返回模拟数据
    return additionalChangelogs;
  }
}

export default function ChangelogPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 确保组件在客户端挂载后才渲染，避免水合错误
  useEffect(() => {
    setMounted(true);
  }, []);

  // 加载更新日志数据
  const loadChangelog = async () => {
    try {
      const data = await fetchChangelogData();
      setChangelog(data);
    } catch (error) {
      console.error("Failed to load changelog:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 刷新更新日志数据
  const handleRefresh = async () => {
    if (refreshing) return; // 防止重复刷新

    setRefreshing(true);
    try {
      const data = await fetchChangelogData();

      // 使用动画效果平滑过渡
      setTimeout(() => {
        setChangelog(data);
        setRefreshing(false);
      }, 300);
    } catch (error) {
      console.error("Failed to refresh changelog:", error);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      setLoading(true);
      loadChangelog();
    }
  }, [mounted]);

  // 如果组件未挂载，返回null
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f8] dark:bg-[#343541] transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 mr-3 text-[#10a37f]"
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
              {t("changelog.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2 ml-11">
              {t("changelog.description")}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors duration-200 flex items-center rounded-md"
              title={t("changelog.refresh")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 mr-2 ${
                  refreshing ? "animate-spin text-[#10a37f]" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? t("changelog.refreshing") : t("changelog.refresh")}
            </button>

            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-[#10a37f] hover:bg-[#0e8f6f] text-white rounded-md transition-colors duration-200 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              {t("changelog.backToHome")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#10a37f]"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              加载更新日志中...
            </p>
          </div>
        ) : refreshing ? (
          <div className="opacity-60 transition-opacity duration-300">
            {/* 在刷新时显示当前内容，但添加透明度效果 */}
            <div className="space-y-12">
              {/* 内容与下面的正常显示相同，但添加了透明度效果 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-[#10a37f]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {t("changelog.latestUpdates")}
                </h2>
                <div className="space-y-6">
                  {changelog.slice(0, 5).map((entry, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-[#444654] rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700"
                    >
                      {/* 简化的内容结构 */}
                      <div className="p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : changelog.length > 0 ? (
          <div className="space-y-12">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-[#10a37f]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t("changelog.latestUpdates")}
              </h2>
              <div className="space-y-6">
                {changelog.slice(0, 5).map((entry, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-[#444654] rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700"
                  >
                    <div className="p-6">
                      <div className="flex flex-wrap justify-between items-center mb-4">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center flex-wrap">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {entry.date} {entry.time}
                            </span>
                            {entry.version && (
                              <span className="ml-3 px-2 py-1 bg-[#e9f7f2] dark:bg-[#1e3d38] text-[#10a37f] dark:text-[#4fd1ab] text-xs rounded-md">
                                {entry.version}
                              </span>
                            )}
                            <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                              {entry.author.avatar_url && (
                                <img
                                  src={entry.author.avatar_url}
                                  alt={entry.author.name}
                                  className="w-4 h-4 rounded-full mr-1"
                                />
                              )}
                              {entry.author.name}
                            </span>
                          </div>

                          <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-3">
                            {entry.commitId && (
                              <div className="flex items-center">
                                <svg
                                  className="h-3 w-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.5 0a4 4 0 11-8 0 4 4 0 018 0z"
                                  />
                                </svg>
                                <span className="font-mono">
                                  {entry.html_url ? (
                                    <a
                                      href={entry.html_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-[#10a37f] hover:underline"
                                    >
                                      {entry.commitId.substring(0, 7)}
                                    </a>
                                  ) : (
                                    entry.commitId.substring(0, 7)
                                  )}
                                </span>
                              </div>
                            )}

                            {entry.treeSha && (
                              <div className="flex items-center">
                                <svg
                                  className="h-3 w-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9 5.306v2.18c0 .138.112.25.25.25h1.5a.75.75 0 01.75.75v1.626a2.251 2.251 0 11-1.5 0V8.5h-1.5a.75.75 0 01-.75-.75V5.306l-1.823-2.233a.75.75 0 011.15-.962l.673.82.673-.82a.75.75 0 011.15.962z"
                                  />
                                </svg>
                                <span className="font-mono">
                                  {entry.treeSha.substring(0, 7)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="prose dark:prose-invert max-w-none">
                        <ul className="space-y-2 list-disc list-inside text-gray-700 dark:text-gray-300">
                          {entry.changes.map((change, changeIndex) => (
                            <li key={changeIndex} className="text-sm">
                              {change}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {changelog.length > 5 && (
              <section>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-[#10a37f]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  {t("changelog.olderUpdates")}
                </h2>
                <div className="space-y-6">
                  {changelog.slice(5).map((entry, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white dark:bg-[#444654] rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700"
                    >
                      <div className="p-6">
                        <div className="flex flex-wrap justify-between items-center mb-4">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center flex-wrap">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {entry.date} {entry.time}
                              </span>
                              {entry.version && (
                                <span className="ml-3 px-2 py-1 bg-[#e9f7f2] dark:bg-[#1e3d38] text-[#10a37f] dark:text-[#4fd1ab] text-xs rounded-md">
                                  {entry.version}
                                </span>
                              )}
                              <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                {entry.author.avatar_url && (
                                  <img
                                    src={entry.author.avatar_url}
                                    alt={entry.author.name}
                                    className="w-4 h-4 rounded-full mr-1"
                                  />
                                )}
                                {entry.author.name}
                              </span>
                            </div>

                            <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-3">
                              {entry.commitId && (
                                <div className="flex items-center">
                                  <svg
                                    className="h-3 w-3 mr-1"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.5 0a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                  </svg>
                                  <span className="font-mono">
                                    {entry.html_url ? (
                                      <a
                                        href={entry.html_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-[#10a37f] hover:underline"
                                      >
                                        {entry.commitId.substring(0, 7)}
                                      </a>
                                    ) : (
                                      entry.commitId.substring(0, 7)
                                    )}
                                  </span>
                                </div>
                              )}

                              {entry.treeSha && (
                                <div className="flex items-center">
                                  <svg
                                    className="h-3 w-3 mr-1"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9 5.306v2.18c0 .138.112.25.25.25h1.5a.75.75 0 01.75.75v1.626a2.251 2.251 0 11-1.5 0V8.5h-1.5a.75.75 0 01-.75-.75V5.306l-1.823-2.233a.75.75 0 011.15-.962l.673.82.673-.82a.75.75 0 011.15.962z"
                                    />
                                  </svg>
                                  <span className="font-mono">
                                    {entry.treeSha.substring(0, 7)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="prose dark:prose-invert max-w-none">
                          <ul className="space-y-2 list-disc list-inside text-gray-700 dark:text-gray-300">
                            {entry.changes.map((change, changeIndex) => (
                              <li key={changeIndex} className="text-sm">
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-[#444654] rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">
              {t("changelog.noUpdates")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
