"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { parseStringPromise } from "xml2js";
import { IoMdRefresh } from "react-icons/io";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import { FiClock, FiUser, FiTag, FiExternalLink } from "react-icons/fi";

interface RssItem {
  title: string;
  link: string;
  description: string;
  category?: string;
  pubDate: string;
  creator?: string;
  thumbnail?: string;
}

// 现代化的骨架屏组件
const SkeletonItem = () => (
  <div className="flex flex-col md:flex-row gap-4 p-4 border-b border-gray-100 dark:border-gray-800 animate-pulse">
    <div className="w-full md:w-1/4 h-32 md:h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
    <div className="flex-1">
      <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
      <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
      <div className="flex gap-3">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  </div>
);

export default function RssFeed() {
  const { t, locale } = useTranslations();
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFeedTitle, setCurrentFeedTitle] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // 默认折叠状态

  // RSS源列表
  const chineseRssSources = [
    { url: "https://www.oschina.net/news/rss", title: "开源中国" },
    {
      url: "https://www.ithome.com/rss/",
      title: "IT之家",
    },
    {
      url: "https://sspai.com/feed",
      title: "少数派",
    },
    {
      url: "https://www.gcores.com/rss",
      title: "机核",
    },
    {
      url: "https://www.solidot.org/index.rss",
      title: "Solidot",
    },
    {
      url: "https://feeds.appinn.com/appinns/",
      title: "Appinn",
    },
    {
      url: "https://www.geekpark.net/rss",
      title: "GeekPark",
    },
  ];

  const englishRssSources = [
    { url: "https://news.ycombinator.com/rss", title: "Hacker News" },
    {
      url: "http://feeds.arstechnica.com/arstechnica/index/",
      title: "Ars Technica",
    },
    { url: "https://techcrunch.com/feed/", title: "TechCrunch" },
    { url: "https://lobste.rs/rss", title: "Lobsters" },
    { url: "https://dev.to/feed", title: "DEV Community" },
    { url: "https://stackoverflow.blog/feed/", title: "Stack Overflow Blog" },
  ];

  // 判断是否为中文环境
  const isChineseLocale = locale === "zh";

  // 根据语言选择对应的RSS源列表
  const rssSources = isChineseLocale ? chineseRssSources : englishRssSources;

  // 随机选择一个RSS源
  const getRandomRssSource = () => {
    const randomIndex = Math.floor(Math.random() * rssSources.length);
    return rssSources[randomIndex];
  };

  const fetchRss = async () => {
    try {
      setLoading(true);
      setError(null);

      // 随机选择一个RSS源
      const selectedSource = getRandomRssSource();
      setCurrentFeedTitle(selectedSource.title);

      const rssToJsonUrl = "https://api.rss2json.com/v1/api.json?rss_url=";
      const response = await fetch(
        `${rssToJsonUrl}${encodeURIComponent(selectedSource.url)}` +
          "&seed=" +
          Math.random(),
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`${t("rssFeed.error")}: ${response.status}`);
      }

      const data = await response.json();

      // RSS2JSON 返回的是已解析好的JSON格式，不需要进一步解析XML
      if (data.status === "ok" && data.items && data.items.length > 0) {
        const parsedItems = data.items
          .map((item: any) => ({
            title: item.title,
            link: item.link,
            description: item.description || "",
            category:
              item.categories && item.categories.length > 0
                ? item.categories[0]
                : "Technology",
            pubDate: item.pubDate,
            creator: item.author,
            thumbnail: item.thumbnail || "",
          }))
          .slice(0, 10); // 只显示前10条

        setItems(parsedItems);
      } else {
        throw new Error("RSS 源返回数据格式不正确");
      }
    } catch (err) {
      console.error("获取RSS:", err);
      setError(err instanceof Error ? err.message : t("rssFeed.error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 点击刷新按钮
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    fetchRss();
  };

  // 处理展开/折叠
  const toggleExpand = () => {
    // 如果是首次展开且没有数据，则加载数据
    if (!isExpanded && items.length === 0 && !loading && !error) {
      fetchRss();
    }
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    // 当语言变化且面板已展开时，重新获取RSS
    if (isExpanded) {
      fetchRss();
    }
  }, [locale, isExpanded]); // 当语言变化或面板展开状态变化时触发

  // 格式化发布日期
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(isChineseLocale ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  // 处理CDATA内容
  const extractCdata = (text: string | undefined): string => {
    if (!text) return "";
    // 处理CDATA标签
    const cdataMatch = text.match(/<!\[CDATA\[(.*?)\]\]>/);
    if (cdataMatch && cdataMatch[1]) {
      return cdataMatch[1].trim();
    }
    return text.trim();
  };

  // 提取描述中的第一段文本
  const extractFirstParagraph = (html: string) => {
    // 首先处理CDATA
    const content = extractCdata(html);
    // 然后移除HTML标签
    const text = content.replace(/<[^>]*>/g, " ").trim();
    return (
      text.split(/\s+/).slice(0, 15).join(" ") +
      (text.split(/\s+/).length > 15 ? "..." : "")
    );
  };

  // 从文章描述中提取第一张图片的URL
  const extractImageFromDescription = (description: string): string | null => {
    if (!description) return null;

    // 处理CDATA
    const content = extractCdata(description);
    // 尝试从HTML中匹配图片
    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
    return imgMatch ? imgMatch[1] : null;
  };

  // 处理图片加载错误
  const handleImageError = (
    event: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    event.currentTarget.style.display = "none";
  };

  // 现代化标题栏
  const renderHeader = () => (
    <div
      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b-2 border-red-500 dark:border-red-600 rounded-t-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm"
      onClick={toggleExpand}
    >
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 mr-2 text-red-600 dark:text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
        <span className="relative">
          {t("rssFeed.title")}
          {currentFeedTitle && (
            <span className="ml-1 text-red-600 dark:text-red-500 font-normal">
              {currentFeedTitle}
            </span>
          )}
        </span>
      </h2>
      <div className="flex items-center">
        {isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // 阻止事件冒泡到父元素
              handleRefresh();
            }}
            disabled={refreshing || loading}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mr-2 hover:text-red-600 dark:hover:text-red-400"
            aria-label="刷新"
          >
            <IoMdRefresh
              className={`h-5 w-5 ${
                refreshing || loading ? "animate-spin" : ""
              }`}
            />
          </button>
        )}
        {isExpanded ? (
          <IoChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        ) : (
          <IoChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full mt-6">
      {renderHeader()}

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden bg-white dark:bg-gray-800 rounded-b-lg shadow-sm border border-t-0 border-gray-200 dark:border-gray-700"
          >
            {loading && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {Array(4)
                  .fill(0)
                  .map((_, index) => (
                    <SkeletonItem key={index} />
                  ))}
              </div>
            )}

            {error && !loading && (
              <div className="p-4">
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-600 p-4 rounded">
                  <p className="text-red-600 dark:text-red-400 flex items-center">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    {error}
                  </p>
                </div>
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200"
                  >
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 md:p-5"
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* 图片区域 */}
                        {(item.thumbnail ||
                          extractImageFromDescription(item.description)) && (
                          <div className="w-full md:w-1/4 h-48 md:h-32 overflow-hidden rounded-lg">
                            <img
                              src={
                                item.thumbnail ||
                                extractImageFromDescription(item.description)!
                              }
                              alt={extractCdata(item.title)}
                              onError={handleImageError}
                              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}

                        {/* 内容区域 */}
                        <div className="flex-1">
                          <div className="mb-1">
                            <span className="inline-block px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded">
                              {item.category || t("rssFeed.uncategorized")}
                            </span>
                          </div>

                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {extractCdata(item.title)}
                          </h3>

                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                            {extractFirstParagraph(item.description)}
                          </p>

                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center">
                              <FiClock className="mr-1" />
                              <span>{formatDate(item.pubDate)}</span>
                            </div>

                            {item.creator && (
                              <div className="flex items-center">
                                <FiUser className="mr-1" />
                                <span className="truncate max-w-[150px]">
                                  {extractCdata(item.creator)}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center ml-auto text-red-600 dark:text-red-400 group-hover:underline">
                              <span>{t("rssFeed.readMore")}</span>
                              <FiExternalLink className="ml-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
