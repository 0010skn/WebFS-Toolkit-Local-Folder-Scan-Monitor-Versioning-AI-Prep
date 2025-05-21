"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { parseStringPromise } from "xml2js";
import { IoMdRefresh } from "react-icons/io";

interface RssItem {
  title: string;
  link: string;
  description: string;
  category?: string;
  pubDate: string;
  creator?: string;
  thumbnail?: string;
}

// 添加骨架屏组件
const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
      <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 rounded mb-3 animate-pulse"></div>
      <div className="h-6 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
      <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3 animate-pulse"></div>
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3 animate-pulse"></div>
      <div className="flex justify-between items-center">
        <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    </div>
  </div>
);

export default function RssFeed() {
  const { t, locale } = useTranslations();
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFeedTitle, setCurrentFeedTitle] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
        `${rssToJsonUrl}${encodeURIComponent(selectedSource.url)}`,
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

  useEffect(() => {
    fetchRss();
  }, [locale]); // 当语言变化时，重新获取RSS

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

  if (loading) {
    return (
      <div className="w-full mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-red-600"
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
            {t("rssFeed.loading")}
          </div>
          <button
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={true}
            aria-label="刷新"
          >
            <IoMdRefresh className="h-5 w-5 animate-spin" />
          </button>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <SkeletonCard key={index} />
            ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-red-600"
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
            {t("rssFeed.title")}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="刷新"
          >
            <IoMdRefresh
              className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2 text-red-600"
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
          {currentFeedTitle}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          aria-label="刷新"
        >
          <IoMdRefresh
            className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded">
                  {item.category || t("rssFeed.uncategorized")}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(item.pubDate)}
                </span>
              </div>

              {item.thumbnail && (
                <div className="mb-3 overflow-hidden rounded">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    onError={handleImageError}
                    className="w-full h-48 object-cover transform hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {!item.thumbnail &&
                extractImageFromDescription(item.description) && (
                  <div className="mb-3 overflow-hidden rounded">
                    <img
                      src={extractImageFromDescription(item.description)!}
                      alt={item.title}
                      onError={handleImageError}
                      className="w-full h-48 object-cover transform hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                {extractCdata(item.title)}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                {extractFirstParagraph(item.description)}
              </p>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[50%]">
                  {item.creator
                    ? `${t("rssFeed.author")}: ${extractCdata(item.creator)}`
                    : ""}
                </span>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  {t("rssFeed.readMore")} →
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
