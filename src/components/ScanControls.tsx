"use client";

import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  currentScanAtom,
  previousScanAtom,
  changeReportAtom,
  scanStatusAtom,
  errorMessageAtom,
  isMonitoringAtom,
  monitorIntervalAtom,
  lastScanTimeAtom,
  showAllFilesAtom,
  readmeContentAtom,
  dockerfilesAtom,
} from "../lib/store";
import {
  performScan,
  compareScans,
  downloadTextReport,
  startFileSystemMonitoring,
  stopFileSystemMonitoring,
} from "../lib/scanService";
import { isFileSystemObserverSupported } from "../lib/fileObserver";
import { useTranslations } from "./LocaleProvider";
import { motion, AnimatePresence } from "framer-motion";
import { detectDockerfile } from "../lib/dockerService";

export default function ScanControls() {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [currentScan, setCurrentScan] = useAtom(currentScanAtom);
  const [previousScan, setPreviousScan] = useAtom(previousScanAtom);
  const [changeReport, setChangeReport] = useAtom(changeReportAtom);
  const [scanStatus, setScanStatus] = useAtom(scanStatusAtom);
  const [errorMessage, setErrorMessage] = useAtom(errorMessageAtom);
  const [isMonitoring, setIsMonitoring] = useAtom(isMonitoringAtom);
  const [monitorInterval] = useAtom(monitorIntervalAtom);
  const [lastScanTime, setLastScanTime] = useAtom(lastScanTimeAtom);
  const [showAllFiles, setShowAllFiles] = useAtom(showAllFilesAtom);
  const [readmeContent, setReadmeContent] = useAtom(readmeContentAtom);
  const [_, setDockerfiles] = useAtom(dockerfilesAtom);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isUsingObserver, setIsUsingObserver] = useState(false);
  const [observerSupported, setObserverSupported] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // 监控定时器引用
  const monitorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 检查FileSystemObserver是否被支持
  useEffect(() => {
    setObserverSupported(isFileSystemObserverSupported());
  }, []);

  // 模拟扫描进度动画
  useEffect(() => {
    let progress = 0;
    let interval: NodeJS.Timeout | null = null;
    let timer: NodeJS.Timeout | null = null;

    if (scanStatus === "scanning") {
      setScanProgress(0);
      setScanCompleted(false);

      interval = setInterval(() => {
        if (progress < 95) {
          progress += Math.random() * 10;
          progress = Math.min(progress, 95);
          setScanProgress(progress);
        } else {
          if (interval) clearInterval(interval);
        }
      }, 150);
    } else if (scanStatus === "idle" && scanProgress > 0) {
      setScanProgress(100);
      setScanCompleted(true);

      timer = setTimeout(() => {
        setScanProgress(0);
      }, 1500);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [scanStatus]);

  // 监控脉冲动画
  useEffect(() => {
    if (isMonitoring) {
      setShowPulse(true);
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
      }
      pulseTimerRef.current = setInterval(() => {
        setShowPulse((prev) => !prev);
      }, 2000);
    } else {
      setShowPulse(false);
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    }

    return () => {
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
      }
    };
  }, [isMonitoring]);

  // 检测是否包含Dockerfile
  useEffect(() => {
    if (!directoryHandle) return;

    const checkForDockerfiles = async () => {
      try {
        const result = await detectDockerfile(directoryHandle);
        setDockerfiles(result);
        if (result.exists) {
          console.log("项目中检测到Docker文件:", result.paths);
        }
      } catch (error) {
        console.error("检测Docker文件时出错:", error);
      }
    };

    checkForDockerfiles();
  }, [directoryHandle, setDockerfiles]);

  // 扫描函数
  const handleScan = async () => {
    if (!directoryHandle || scanStatus === "scanning") return;

    try {
      setScanStatus("scanning");
      setErrorMessage(null);

      // 尝试读取README.md文件
      try {
        const readmeHandle = await directoryHandle.getFileHandle("README.md", {
          create: false,
        });
        const readmeFile = await readmeHandle.getFile();
        const readmeContent = await readmeFile.text();
        // 存储README内容
        setReadmeContent(readmeContent);
        console.log("README.md 文件已读取");
      } catch (error) {
        console.log("未找到README.md文件或无法读取");
        setReadmeContent(null);
      }

      // 执行扫描
      const scanResult = await performScan(directoryHandle);

      // 如果之前已有扫描结果，则前一次结果变为上一次结果
      if (currentScan) {
        setPreviousScan(currentScan);

        // 生成差异报告
        const report = compareScans(currentScan, scanResult, showAllFiles);
        setChangeReport(report);
      } else {
        // 首次扫描,创建一个与自身比较的报告(显示所有文件)
        const report = compareScans(scanResult, scanResult, true);
        setChangeReport(report);
      }

      // 更新当前扫描结果
      setCurrentScan(scanResult);
      setLastScanTime(scanResult.timestamp);

      // 如果正在监控,每次扫描后都重新初始化监控以包含新的文件夹
      if (isMonitoring && directoryHandle) {
        console.log("扫描完成，重新初始化文件系统监控以包含新目录");

        // 无论是否使用观察器，都重新初始化
        const stillUsingObserver = await startFileSystemMonitoring(
          directoryHandle,
          handleFileChange
        );

        // 更新观察器状态
        setIsUsingObserver(stillUsingObserver);

        // 如果使用轮询，重置定时器
        if (!stillUsingObserver) {
          if (monitorTimerRef.current) {
            clearInterval(monitorTimerRef.current);
          }
          monitorTimerRef.current = setInterval(handleScan, monitorInterval);
        }
      }

      setScanStatus("idle");
    } catch (error) {
      console.error("扫描过程中出错:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "扫描过程中出错"
      );
      setScanStatus("error");
    }
  };

  // 下载报告
  const handleDownloadReport = () => {
    if (!changeReport) return;

    setIsDownloading(true);
    setScanStatus("preparing"); // 设置状态为正在准备下载报告

    try {
      // 使用下载报告的函数
      downloadTextReport(changeReport);

      // 在下载完成后重置状态
      setTimeout(() => {
        setScanStatus("idle");
        setIsDownloading(false);
      }, 1500); // 给足够的时间完成下载
    } catch (error) {
      console.error("下载报告时出错:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "下载报告时出错"
      );
      setScanStatus("error");
      setIsDownloading(false);
    }
  };

  // 文件变化处理函数
  const handleFileChange = async (isObserverChange: boolean) => {
    // 如果正在扫描中，跳过
    if (scanStatus === "scanning") return;

    console.log(
      `${t("scanControls.changeDetected")}，由${
        isObserverChange ? "FileSystemObserver" : "轮询"
      }触发`
    );

    // 执行扫描并更新UI
    await handleScan();

    // 强制重新初始化文件观察器，确保新文件夹被监控
    if (isMonitoring && directoryHandle && isObserverChange) {
      console.log("检测到文件变化，强制重新初始化文件观察器");

      // 延迟一小段时间，确保文件系统状态已稳定
      setTimeout(async () => {
        const stillUsingObserver = await startFileSystemMonitoring(
          directoryHandle,
          handleFileChange
        );

        // 更新观察器状态
        setIsUsingObserver(stillUsingObserver);

        console.log("文件观察器已重新初始化");
      }, 500);
    }
  };

  // 监控效果
  useEffect(() => {
    setShowAllFiles(true);

    // 组件卸载时清理
    return () => {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
      }
      // 确保停止观察器
      stopFileSystemMonitoring();
    };
  }, []);

  // 当目录句柄变化时,自动执行一次扫描
  useEffect(() => {
    if (directoryHandle) {
      console.log("检测到目录句柄变化,自动执行扫描");
      // 重置扫描状态,确保新文件夹的扫描能正确执行
      setCurrentScan(null);
      setPreviousScan(null);
      setChangeReport(null);
      // 执行扫描
      setTimeout(() => {
        handleScan();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryHandle]);

  // 当目录句柄或监控间隔变化时，重启监控
  useEffect(() => {
    if (isMonitoring && !isUsingObserver && directoryHandle) {
      // 仅在使用轮询时才需要重置定时器
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
      }
      monitorTimerRef.current = setInterval(handleScan, monitorInterval);
    }

    return () => {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
      }
    };
  }, [directoryHandle, monitorInterval, isMonitoring, isUsingObserver]);

  // 切换监控状态
  const toggleMonitoring = async () => {
    if (isMonitoring) {
      // 如果当前正在监控，则停止
      stopFileSystemMonitoring();
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
        monitorTimerRef.current = null;
      }
      setIsMonitoring(false);
      setIsUsingObserver(false);
    } else {
      // 开始监控前先执行一次完整扫描,确保能捕获所有文件夹
      console.log("开始监控前执行完整扫描");
      await handleScan();

      // 开始监控
      setIsMonitoring(true);

      if (directoryHandle) {
        // 尝试使用FileSystemObserver
        const usingObserver = await startFileSystemMonitoring(
          directoryHandle,
          handleFileChange
        );

        // 更新观察器状态
        setIsUsingObserver(usingObserver);

        // 如果不支持观察器或启用失败，则使用轮询
        if (!usingObserver) {
          console.log(
            "FileSystemObserver不支持或启用失败，使用轮询监控，间隔:",
            monitorInterval
          );
          monitorTimerRef.current = setInterval(handleScan, monitorInterval);
        }
      }
    }
  };

  // 如果没有目录句柄，不显示控制器
  if (!directoryHandle) return null;

  return (
    <div>
      <AnimatePresence mode="wait">
        {scanProgress > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <div className="relative pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:bg-blue-900 dark:text-blue-300">
                    {scanCompleted
                      ? "扫描完成"
                      : `${Math.round(scanProgress)}% 完成`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block">
                    {scanCompleted ? (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-green-500"
                      >
                        ✓ 已完成
                      </motion.span>
                    ) : (
                      `${Math.round(scanProgress)}%`
                    )}
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-blue-100 dark:bg-gray-700">
                <motion.div
                  animate={{ width: `${scanProgress}%` }}
                  initial={{ width: "0%" }}
                  transition={{
                    duration: scanCompleted ? 0.3 : 0.5,
                    ease: scanCompleted ? "easeOut" : "easeInOut",
                  }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center relative ${
                    scanCompleted ? "bg-green-500" : "bg-blue-500"
                  }`}
                >
                  {/* 扫描中的波纹效果 */}
                  {!scanCompleted && scanStatus === "scanning" && (
                    <>
                      <motion.div
                        className="absolute top-0 left-0 h-full w-full bg-white opacity-30"
                        animate={{ x: ["0%", "100%"] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                      <motion.div
                        className="absolute top-0 left-0 h-full w-full bg-white opacity-20"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                          delay: 0.5,
                        }}
                      />
                    </>
                  )}

                  {/* 完成时的闪光效果 */}
                  {scanCompleted && (
                    <motion.div
                      initial={{ width: 0, opacity: 0.7 }}
                      animate={{ width: "100%", opacity: 0 }}
                      className="absolute top-0 left-0 h-full bg-green-200"
                      transition={{
                        duration: 0.7,
                        repeat: 1,
                        repeatType: "reverse",
                      }}
                    />
                  )}
                </motion.div>
              </div>
              {scanStatus === "scanning" && (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic animate-pulse">
                  正在扫描文件...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-3 mb-3">
        <motion.button
          onClick={handleScan}
          disabled={scanStatus === "scanning"}
          className={`px-4 py-2 rounded-md text-white transition-colors ${
            scanStatus === "scanning"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          }`}
          whileHover={{ scale: scanStatus === "scanning" ? 1 : 1.05 }}
          whileTap={{ scale: scanStatus === "scanning" ? 1 : 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <span className="flex items-center">
            {scanStatus === "scanning" ? (
              <>
                <motion.svg
                  className="-ml-1 mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  animate={{
                    rotate: 360,
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    rotate: {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    },
                    scale: {
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </motion.svg>
                <motion.span
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {t("scanControls.scanning")}
                </motion.span>
              </>
            ) : (
              <>
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </motion.svg>
                {t("scanControls.startScan")}
              </>
            )}
          </span>
        </motion.button>

        <motion.button
          onClick={toggleMonitoring}
          disabled={scanStatus === "scanning"}
          className={`px-4 py-2 rounded-md text-white transition-colors flex items-center relative ${
            scanStatus === "scanning"
              ? "bg-gray-400 cursor-not-allowed"
              : isMonitoring
              ? "bg-red-500 hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              : "bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          }`}
          whileHover={{ scale: scanStatus === "scanning" ? 1 : 1.05 }}
          whileTap={{ scale: scanStatus === "scanning" ? 1 : 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          {isMonitoring && showPulse && (
            <motion.span
              initial={{ opacity: 0.7, scale: 1 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 bg-red-400 rounded-md z-0"
            ></motion.span>
          )}
          <span className="flex items-center relative z-10">
            {isMonitoring ? (
              <>
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </motion.svg>
                <motion.span
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {t("scanControls.stopMonitoring")}
                </motion.span>
              </>
            ) : (
              <>
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  animate={{
                    rotate: [0, 10, 0, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    rotate: {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </motion.svg>
                {t("scanControls.startMonitoring")}
              </>
            )}
          </span>
        </motion.button>

        {currentScan && (
          <motion.button
            onClick={handleDownloadReport}
            disabled={isDownloading || !changeReport}
            className={`px-4 py-2 rounded-md text-white transition-colors ${
              isDownloading || !changeReport
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            }`}
            whileHover={{ scale: isDownloading || !changeReport ? 1 : 1.05 }}
            whileTap={{ scale: isDownloading || !changeReport ? 1 : 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <span className="flex items-center">
              {isDownloading || scanStatus === "preparing" ? (
                <>
                  <motion.svg
                    className="-ml-1 mr-2 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    animate={{
                      rotate: 360,
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      rotate: {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear",
                      },
                      scale: {
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }}
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </motion.svg>
                  <motion.span
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {scanStatus === "preparing"
                      ? t("scanControls.preparingReport")
                      : t("scanControls.downloading")}
                  </motion.span>
                </>
              ) : (
                <>
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    animate={{
                      y: [0, -2, 0, 2, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </motion.svg>
                  {t("scanControls.download")}
                </>
              )}
            </span>
          </motion.button>
        )}
      </div>

      {/* 监控状态指示器 */}
      <AnimatePresence>
        {isMonitoring && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 rounded-md bg-gray-100 dark:bg-gray-800 text-sm"
          >
            <div className="flex items-center">
              <div className="mr-2 flex-shrink-0">
                <motion.div
                  className={`h-3 w-3 rounded-full ${
                    isUsingObserver ? "bg-green-500" : "bg-yellow-500"
                  }`}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
              <div className="flex-grow">
                <p className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  {t("scanControls.monitoring")}{" "}
                  <motion.span
                    className="inline-block ml-1"
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    •••
                  </motion.span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {isUsingObserver
                    ? t("scanControls.usingObserver")
                    : `${t("scanControls.usingPolling")} ${
                        monitorInterval / 1000
                      } ${t("scanControls.seconds")}`}
                </p>
                {lastScanTime && (
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {t("scanControls.lastScanTime")}:{" "}
                    {new Date(lastScanTime).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <motion.div
                  className="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-gray-600 relative"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <motion.div
                    className="absolute top-0 left-1/2 w-1 h-1 bg-green-500 rounded-full transform -translate-x-1/2"
                    style={{ marginTop: "-2px" }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-blue-500 rounded-full absolute"
                    animate={{
                      x: ["0%", "100%", "0%", "-100%", "0%"],
                      y: ["0%", "100%", "0%", "-100%", "0%"],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{ left: "calc(50% - 4px)", top: "calc(50% - 4px)" }}
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
