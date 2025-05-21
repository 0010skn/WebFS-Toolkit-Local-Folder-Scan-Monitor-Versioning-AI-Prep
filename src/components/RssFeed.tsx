"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { parseStringPromise } from "xml2js";

interface RssItem {
  title: string;
  link: string;
  description: string;
  category?: string;
  pubDate: string;
  creator?: string;
}

export default function RssFeed() {
  const { t } = useTranslations();
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRss = async () => {
      try {
        setLoading(true);
        const response = await fetch("https://linux.do/latest.rss", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`获取RSS失败: ${response.status}`);
        }

        const xmlText = await response.text();
        const result = await parseStringPromise(xmlText, {
          explicitArray: false,
        });

        if (result?.rss?.channel?.item) {
          const rssItems = Array.isArray(result.rss.channel.item)
            ? result.rss.channel.item
            : [result.rss.channel.item];

          const parsedItems = rssItems
            .map((item: any) => ({
              title: item.title,
              link: item.link,
              description: item.description,
              category: item.category,
              pubDate: item.pubDate,
              creator: item["dc:creator"],
            }))
            .slice(0, 10); // 只显示前10条

          setItems(parsedItems);
        }
      } catch (err) {
        console.error("获取RSS feed失败:", err);
        setError(err instanceof Error ? err.message : "获取RSS feed失败");
      } finally {
        setLoading(false);
      }
    };

    fetchRss();
  }, []);

  // 格式化发布日期
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
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

  if (loading) {
    return (
      <div className="w-full mt-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("rssFeed.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
        {t("rssFeed.title")}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded">
                  {item.category || t("rssFeed.uncategorized")}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(item.pubDate)}
                </span>
              </div>

              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                {extractCdata(item.title)}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                {extractFirstParagraph(item.description)}
              </p>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {item.creator
                    ? `${t("rssFeed.author")}: ${extractCdata(item.creator)}`
                    : ""}
                </span>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
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
