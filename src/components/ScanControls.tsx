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

  const [isDownloading, setIsDownloading] = useState(false);
  const [isUsingObserver, setIsUsingObserver] = useState(false);
  const [observerSupported, setObserverSupported] = useState(false);

  // 监控定时器引用
  const monitorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 检查FileSystemObserver是否被支持
  useEffect(() => {
    setObserverSupported(isFileSystemObserverSupported());
  }, []);

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

    try {
      downloadTextReport(changeReport);
    } catch (error) {
      console.error("下载报告时出错:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "下载报告时出错"
      );
    } finally {
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

        setIsUsingObserver(usingObserver);

        // 如果不支持或失败，使用轮询
        if (!usingObserver) {
          monitorTimerRef.current = setInterval(handleScan, monitorInterval);
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleScan}
          disabled={!directoryHandle || scanStatus === "scanning"}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:bg-green-700 dark:hover:bg-green-800 dark:focus:ring-green-600"
        >
          {scanStatus === "scanning"
            ? t("scanControls.scanning")
            : t("scanControls.startScan")}
        </button>

        <button
          onClick={toggleMonitoring}
          disabled={!directoryHandle}
          className={`px-4 py-2 ${
            isMonitoring
              ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          } text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors`}
        >
          {isMonitoring
            ? t("scanControls.stopMonitoring")
            : t("scanControls.startMonitoring")}
        </button>

        {changeReport && (
          <>
            <button
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:bg-purple-700 dark:hover:bg-purple-800 dark:focus:ring-purple-600"
            >
              {isDownloading
                ? t("scanControls.downloading")
                : t("scanControls.download")}
            </button>
            <span className="text-xs text-pink-500 dark:text-pink-400 font-medium animate-pulse ml-2 self-center bg-pink-100 dark:bg-pink-900/30 px-3 py-1.5 rounded-full shadow-sm border border-pink-200 dark:border-pink-800">
              报告投喂给AI更方便 💖
            </span>
          </>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="showAllFiles"
          checked={showAllFiles}
          onChange={() => setShowAllFiles(!showAllFiles)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:checked:bg-blue-600"
        />
        <label
          htmlFor="showAllFiles"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          {t("scanControls.showAllFiles")}
        </label>
      </div>

      {lastScanTime && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("scanControls.lastScanTime")}:{" "}
          {new Date(lastScanTime).toLocaleString()}
        </p>
      )}

      {isMonitoring && (
        <div className="text-sm">
          <p className="text-green-600 dark:text-green-500 animate-pulse">
            {t("scanControls.monitoring")}{" "}
            {isUsingObserver
              ? t("scanControls.usingObserver")
              : `${t("scanControls.usingPolling")} ${
                  monitorInterval / 1000
                } ${t("scanControls.seconds")}`}
          </p>
          {observerSupported && !isUsingObserver && (
            <p className="text-yellow-600 dark:text-yellow-500 mt-1">
              {t("scanControls.observerFallback")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
