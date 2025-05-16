"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAtom } from "jotai";
import { localeAtom, Locale, loadMessages } from "../lib/i18n";

// 预加载翻译数据
// 这将在应用初始化时立即开始加载翻译
const preloadedTranslationsPromise: Record<Locale, Promise<any>> = {
  en: loadMessages("en"),
  zh: loadMessages("zh"),
};

// 创建翻译上下文
type TranslationsContextType = {
  t: (key: string, params?: Record<string, string>) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const TranslationsContext = createContext<TranslationsContextType | null>(null);

// 翻译钩子
export function useTranslations() {
  const context = useContext(TranslationsContext);
  if (!context) {
    throw new Error("useTranslations must be used within a LocaleProvider");
  }
  return context;
}

// 解析翻译键
function getNestedTranslation(obj: any, path: string): string {
  const keys = path.split(".");
  let result = obj;

  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = result[key];
    } else {
      return path; // 如果找不到翻译，返回原键
    }
  }

  return typeof result === "string" ? result : path;
}

// 替换参数
function replaceParams(text: string, params?: Record<string, string>): string {
  if (!params) return text;

  let result = text;
  for (const key in params) {
    result = result.replace(new RegExp(`{${key}}`, "g"), params[key]);
  }

  return result;
}

// 国际化提供者组件
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useAtom(localeAtom);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // 加载翻译
  useEffect(() => {
    async function loadTranslations() {
      try {
        setLoading(true);

        // 使用预加载的翻译数据
        const messages = await preloadedTranslationsPromise[locale];
        setTranslations(messages);

        // 标记初始加载已完成
        if (!initialLoadComplete) {
          setInitialLoadComplete(true);
        }
      } catch (error) {
        console.error("Failed to load translations:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTranslations();
  }, [locale, initialLoadComplete]);

  // 翻译函数
  const t = (key: string, params?: Record<string, string>): string => {
    // 如果还在加载中，但已经有翻译数据，则尝试使用现有数据
    if (loading && Object.keys(translations).length > 0) {
      const translation = getNestedTranslation(translations, key);
      // 如果能找到翻译，则使用它，否则显示加载占位符
      if (translation !== key) {
        return replaceParams(translation, params);
      }

      // 对于常见的UI元素，提供默认占位符
      if (key.includes("title") || key.includes("name")) return "...";
      return ""; // 其他情况返回空字符串而不是键名
    }

    // 如果没有翻译数据，但不是第一次加载
    if (!translations && initialLoadComplete) return key;

    // 正常情况：有翻译数据且不在加载中
    const translation = getNestedTranslation(translations, key);
    return replaceParams(translation, params);
  };

  // 如果是第一次加载且没有翻译数据，显示一个最小的加载状态
  if (!initialLoadComplete && loading) {
    return null; // 或者返回一个简单的加载指示器
  }

  return (
    <TranslationsContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </TranslationsContext.Provider>
  );
}
