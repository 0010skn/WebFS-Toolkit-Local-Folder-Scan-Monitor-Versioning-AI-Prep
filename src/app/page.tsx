"use client";

import FolderPicker from "../components/FolderPicker";
import ScanControls from "../components/ScanControls";
import ResultDisplay from "../components/ResultDisplay";
import ThemeToggle from "../components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Folda-Scan
            </h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
              本地文件夹扫描与监控工具
            </p>
          </div>
          <ThemeToggle />
        </header>

        <main className="space-y-6">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors duration-300">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              选择文件夹
            </h2>
            <FolderPicker />
            <ScanControls />
          </section>

          <ResultDisplay />
        </main>

        <footer className="mt-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>基于 Next.js 14 和 File System Access API 构建</p>
          <p className="mt-1">支持 .gitignore 规则和实时监控</p>
        </footer>
      </div>
    </div>
  );
}
