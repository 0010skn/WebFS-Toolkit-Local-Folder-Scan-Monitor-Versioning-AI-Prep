"use client";

import FolderPicker from "../components/FolderPicker";
import ScanControls from "../components/ScanControls";
import ResultDisplay from "../components/ResultDisplay";
import ThemeToggle from "../components/ThemeToggle";
import VersionManager from "../components/VersionManager";
import SettingsButton from "../components/SettingsModal";
import { useAtom } from "jotai";
import { directoryHandleAtom } from "../lib/store";
import { useTranslations } from "@/components/LocaleProvider";
import { useTransitionRouter } from "next-view-transitions";
import { slideInOut } from "../lib/publicCutscene";
export default function Home() {
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const { t } = useTranslations();
  const router = useTransitionRouter();

  // 跳转到统计页面
  const handleGoToStatistics = () => {
    router.push("/statistics", {
      onTransitionReady: slideInOut,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("app.title")}
            </h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
              {t("app.description")}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {directoryHandle && (
              <>
                <VersionManager />
                <button
                  onClick={handleGoToStatistics}
                  className="px-3 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-300 flex items-center space-x-1"
                  title="项目统计"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                    <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                  </svg>
                  <span>统计</span>
                </button>
              </>
            )}
            <SettingsButton />
            <ThemeToggle />
          </div>
        </header>

        <main className="space-y-6">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors duration-300">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {t("folderPicker.selectFolder")}
            </h2>
            <FolderPicker />
            <ScanControls />
          </section>

          <ResultDisplay />
        </main>

        <footer className="mt-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>{t("about.copyright")}</p>
        </footer>
      </div>
    </div>
  );
}
