"use client";

import { useState, useEffect } from "react";
import { isServiceWorkerSupported } from "@/lib/pwaUtils";
import { isFileSystemObserverSupported } from "@/lib/fileObserver";

// 检查浏览器是否支持File System Access API
function isFileSystemAccessSupported(): boolean {
  return "showDirectoryPicker" in window;
}

export default function BrowserCompatCheck() {
  const [showWarning, setShowWarning] = useState(false);
  const [unsupportedFeatures, setUnsupportedFeatures] = useState<string[]>([]);

  useEffect(() => {
    // 只在客户端执行
    if (typeof window === "undefined") return;

    const unsupported: string[] = [];

    // 检查File System Access API支持
    if (!isFileSystemAccessSupported()) {
      unsupported.push("文件系统访问");
    }

    // 检查Service Worker支持
    if (!isServiceWorkerSupported()) {
      unsupported.push("Service Worker");
    }

    // 若有不支持的功能，显示警告
    if (unsupported.length > 0) {
      setUnsupportedFeatures(unsupported);
      setShowWarning(true);
    }
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-x-0 top-4 flex justify-center z-50">
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 max-w-xl shadow-lg rounded-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium">浏览器兼容性警告</h3>
            <div className="mt-1 text-sm">
              <p>
                您的浏览器不支持以下必要功能:
                <span className="font-bold">
                  {" "}
                  {unsupportedFeatures.join(", ")}
                </span>
              </p>
              <p className="mt-1">
                建议使用 Chrome、Edge 或 Safari 最新版本，并确保安装了所有更新。
              </p>
              <button
                onClick={() => setShowWarning(false)}
                className="mt-2 bg-yellow-200 hover:bg-yellow-300 text-yellow-800 py-1 px-2 rounded text-xs"
              >
                暂时忽略
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
