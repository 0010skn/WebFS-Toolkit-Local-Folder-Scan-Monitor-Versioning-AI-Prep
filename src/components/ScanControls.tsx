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
} from "../lib/scanService";

export default function ScanControls() {
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

  // 监控定时器引用
  const monitorTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // 切换监控状态
  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
  };

  // 监控效果
  useEffect(() => {
    // 清除之前的定时器
    if (monitorTimerRef.current) {
      clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }

    // 如果不监控或没有目录句柄，直接返回
    if (!isMonitoring || !directoryHandle) return;

    // 设置新的定时器
    monitorTimerRef.current = setInterval(handleScan, monitorInterval);

    // 组件卸载时清理
    return () => {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
      }
    };
  }, [isMonitoring, directoryHandle, monitorInterval]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleScan}
          disabled={!directoryHandle || scanStatus === "scanning"}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:bg-green-700 dark:hover:bg-green-800 dark:focus:ring-green-600"
        >
          {scanStatus === "scanning" ? "扫描中..." : "开始扫描"}
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
          {isMonitoring ? "停止监控" : "开始监控"}
        </button>

        {changeReport && (
          <button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:bg-purple-700 dark:hover:bg-purple-800 dark:focus:ring-purple-600"
          >
            {isDownloading ? "下载中..." : "下载报告"}
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
          显示所有文件内容（会在下次扫描后生效）
        </label>
      </div>

      {lastScanTime && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          上次扫描时间: {new Date(lastScanTime).toLocaleString()}
        </p>
      )}

      {isMonitoring && (
        <p className="text-sm text-green-600 dark:text-green-500 animate-pulse">
          监控中... 每 {monitorInterval / 1000} 秒自动扫描一次
        </p>
      )}
    </div>
  );
}
