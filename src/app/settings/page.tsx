"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { themeAtom } from "@/lib/store";
import { useTranslations } from "@/components/LocaleProvider";
import { locales, Locale } from "@/lib/i18n";
import { useTransitionRouter } from "next-view-transitions";
import { slideInOut } from "@/lib/publicCutscene";
import InstallPwaButton from "@/components/InstallPwaButton";

export default function SettingsPage() {
  const router = useTransitionRouter();
  const { t, locale, setLocale } = useTranslations();
  const [theme, setTheme] = useAtom(themeAtom);

  // 切换主题
  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
  };

  // 切换语言
  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
  };

  // 返回主页
  const handleBack = () => {
    router.push("/", {
      onTransitionReady: slideInOut,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* 顶部导航栏 - ChatGPT风格 */}
        <div className="mb-6 flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <button
              onClick={handleBack}
              className="mr-3 p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label={t("settings.back")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.87l-.214 1.28c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.019-.398-1.11-.94l-.213-1.28c-.063-.375-.313-.686-.645-.87a6.449 6.449 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.645-.87l.213-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
              {t("settings.title")}
            </h1>
          </div>
        </div>

        <div className="space-y-4">
          {/* 语言设置 - ChatGPT风格卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("settings.language")}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t("settings.languageDescription")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pl-12">
              {locales.map((localeOption) => (
                <button
                  key={localeOption}
                  onClick={() => handleLocaleChange(localeOption)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    locale === localeOption
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {localeOption === "en" ? "English" : "中文"}
                </button>
              ))}
            </div>
          </div>

          {/* 主题设置 - ChatGPT风格卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("settings.theme")}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t("settings.themeDescription")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pl-12">
              <button
                onClick={() => handleThemeChange("light")}
                className={`p-3 rounded-md flex items-center gap-3 transition-all ${
                  theme === "light"
                    ? "bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 text-gray-800 dark:text-white"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                }`}
              >
                <div
                  className={`p-2 rounded-full ${
                    theme === "light"
                      ? "bg-purple-100 dark:bg-purple-800"
                      : "bg-gray-100 dark:bg-gray-600"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className={`w-5 h-5 ${
                      theme === "light"
                        ? "text-purple-600 dark:text-purple-300"
                        : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{t("settings.lightMode")}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t("settings.lightModeDescription")}
                  </div>
                </div>
                {theme === "light" && (
                  <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="white"
                      className="w-3 h-3"
                    >
                      <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                )}
              </button>

              <button
                onClick={() => handleThemeChange("dark")}
                className={`p-3 rounded-md flex items-center gap-3 transition-all ${
                  theme === "dark"
                    ? "bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 text-gray-800 dark:text-white"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                }`}
              >
                <div
                  className={`p-2 rounded-full ${
                    theme === "dark"
                      ? "bg-purple-100 dark:bg-purple-800"
                      : "bg-gray-100 dark:bg-gray-600"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className={`w-5 h-5 ${
                      theme === "dark"
                        ? "text-purple-600 dark:text-purple-300"
                        : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{t("settings.darkMode")}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t("settings.darkModeDescription")}
                  </div>
                </div>
                {theme === "dark" && (
                  <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="white"
                      className="w-3 h-3"
                    >
                      <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* PWA安装部分 - ChatGPT风格卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("settings.pwaInstall") || "将网页安装为应用"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t("settings.pwaInstallDescription") ||
                    "安装此应用到您的设备，以便离线使用和更好的体验"}
                </p>
              </div>
            </div>
            <div className="pl-12 mt-2">
              <InstallPwaButton />
            </div>
          </div>

          {/* 关于部分 - ChatGPT风格卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-gray-600 dark:text-gray-300"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("settings.about")}
                </h2>
              </div>
            </div>

            <div className="pl-12 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-3 mt-2">
              <h3 className="font-medium text-gray-900 dark:text-white">
                {t("about.title")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("about.description")}
              </p>
              <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <p className="flex justify-between">
                  <span>{t("about.version")}:</span>
                  <span className="font-medium">1.0.0</span>
                </p>
                <p className="flex justify-between">
                  <span>{t("about.developer")}:</span>
                  <span className="font-medium">Folda-Scan Team</span>
                </p>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-gray-600 text-center text-xs text-gray-500 dark:text-gray-400">
                {t("about.copyright")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
