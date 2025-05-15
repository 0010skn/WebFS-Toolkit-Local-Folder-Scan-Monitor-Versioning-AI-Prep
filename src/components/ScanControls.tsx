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

      // 执行扫描
      const scanResult = await performScan(directoryHandle);

      // 如果之前已有扫描结果，则前一次结果变为上一次结果
      if (currentScan) {
        setPreviousScan(currentScan);
      }

      // 更新当前扫描结果
      setCurrentScan(scanResult);
      setLastScanTime(scanResult.timestamp);

      // 如果有上一次结果，生成差异报告
      if (previousScan) {
        const report = compareScans(previousScan, scanResult, showAllFiles);
        setChangeReport(report);
      }

      // 如果正在使用观察器，在扫描后重新初始化观察器以包含可能的新目录
      if (isMonitoring && isUsingObserver && directoryHandle) {
        console.log("扫描完成，重新初始化文件系统观察器以包含新目录");
        const stillUsingObserver = await startFileSystemMonitoring(
          directoryHandle,
          handleFileChange
        );

        // 如果观察器初始化失败，回退到轮询
        if (!stillUsingObserver && isUsingObserver) {
          setIsUsingObserver(false);
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
      handleScan();
    }
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
      // 先执行一次手动扫描
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
          <button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:bg-purple-700 dark:hover:bg-purple-800 dark:focus:ring-purple-600"
          >
            {isDownloading
              ? t("scanControls.downloading")
              : t("scanControls.download")}
          </button>
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
