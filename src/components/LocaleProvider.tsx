"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAtom } from "jotai";
import { localeAtom, Locale, loadMessages } from "@/lib/i18n";

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

  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{${key}}`, "g"), value);
  }, text);
}

// 国际化提供者组件
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useAtom(localeAtom);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // 加载翻译
  useEffect(() => {
    async function loadTranslations() {
      try {
        setLoading(true);
        const messages = await loadMessages(locale);
        setTranslations(messages);
      } catch (error) {
        console.error("Failed to load translations:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTranslations();
  }, [locale]);

  // 翻译函数
  const t = (key: string, params?: Record<string, string>): string => {
    if (loading || !translations) return key;
    const translation = getNestedTranslation(translations, key);
    return replaceParams(translation, params);
  };

  return (
    <TranslationsContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </TranslationsContext.Provider>
  );
}
