import { atom } from "jotai";

// 定义支持的语言列表
export type Locale = "en" | "zh";
export const locales: Locale[] = ["en", "zh"];

// 获取默认语言，优先使用浏览器语言
export function getDefaultLocale(): Locale {
  if (typeof window !== "undefined") {
    const browserLang = navigator.language.split("-")[0] as Locale;
    return locales.includes(browserLang) ? browserLang : "en";
  }
  return "en";
}

// 创建语言原子状态
export const localeAtom = atom<Locale>(getDefaultLocale());

// 加载特定语言的翻译
export async function loadMessages(locale: Locale) {
  return (await import(`../messages/${locale}.json`)).default;
}
