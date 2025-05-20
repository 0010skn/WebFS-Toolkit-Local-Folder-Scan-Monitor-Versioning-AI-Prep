"use client";

import { useState, useEffect } from "react";
import { isMultiThreadScanSupported } from "@/lib/workerUtils";
import { useTranslations } from "./LocaleProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function MultiThreadScanAlert() {
  const [showAlert, setShowAlert] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const { t } = useTranslations();

  useEffect(() => {
    // 只在客户端执行
    if (typeof window === "undefined") return;

    // 检查是否支持多线程扫描
    const supported = isMultiThreadScanSupported();
    setIsSupported(supported);

    // 无论是否支持，都显示提示
    setShowAlert(true);
  }, []);

  // 如果用户关闭了提示，则不显示
  if (!showAlert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`mb-4 ${
          isSupported
            ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700"
            : "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700"
        } border rounded-lg p-4 flex items-start`}
      >
        <div
          className={`flex-shrink-0 ${
            isSupported
              ? "text-green-500 dark:text-green-400"
              : "text-yellow-500 dark:text-yellow-400"
          }`}
        >
          {isSupported ? (
            // 支持多线程扫描时显示的图标
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            // 不支持多线程扫描时显示的图标
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <div
            className={`text-sm ${
              isSupported
                ? "text-green-700 dark:text-green-300"
                : "text-yellow-700 dark:text-yellow-300"
            }`}
          >
            {isSupported ? (
              // 支持多线程扫描时显示的文本
              <>
                <p className="font-medium mb-1">
                  {t("changelog.multiThreadSupport.supported")}
                </p>
              </>
            ) : (
              // 不支持多线程扫描时显示的文本
              <>
                <p className="font-medium mb-1">
                  {t("changelog.multiThreadSupport.notSupported")}
                </p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAlert(false)}
          className={`ml-auto flex-shrink-0 ${
            isSupported
              ? "text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              : "text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
          } focus:outline-none`}
          aria-label="关闭提示"
        >
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
