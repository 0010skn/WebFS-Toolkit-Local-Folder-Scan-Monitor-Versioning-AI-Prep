import { atom } from "jotai";

// 定义支持的语言列表
export type Locale = "en" | "zh";
export const locales: Locale[] = ["en", "zh"];

// 翻译缓存
const translationsCache: Record<Locale, any> = {
  en: null,
  zh: null,
};

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
  // 如果缓存中已有翻译，直接返回
  if (translationsCache[locale]) {
    return translationsCache[locale];
  }

  try {
    // 加载翻译
    const messages = (await import(`../messages/${locale}.json`)).default;

    // 缓存翻译
    translationsCache[locale] = messages;

    return messages;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);

    // 如果加载失败，尝试返回英文翻译作为后备
    if (locale !== "en") {
      return loadMessages("en");
    }

    // 如果英文翻译也加载失败，返回空对象
    return {};
  }
}
