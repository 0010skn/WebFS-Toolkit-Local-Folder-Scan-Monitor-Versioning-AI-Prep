"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  versionHistoryAtom,
  showVersionModalAtom,
  versionOperationStatusAtom,
  versionOperationMessageAtom,
  versionBackupInfoAtom,
  backupProgressAtom,
  restoreProgressAtom,
  currentScanAtom,
  previousScanAtom,
  changeReportAtom,
  scanStatusAtom,
  lastScanTimeAtom,
} from "../lib/store";
import {
  getVersionHistory,
  createVersionBackup,
  restoreVersion,
} from "../lib/versionService";
import { performScan, compareScans } from "../lib/scanService";
import { VersionHistoryItem } from "@/types";
import { useTranslations } from "./LocaleProvider";

export default function VersionManager() {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [versionHistory, setVersionHistory] = useAtom(versionHistoryAtom);
  const [showVersionModal, setShowVersionModal] = useAtom(showVersionModalAtom);
  const [operationStatus, setOperationStatus] = useAtom(
    versionOperationStatusAtom
  );
  const [operationMessage, setOperationMessage] = useAtom(
    versionOperationMessageAtom
  );
  const [backupInfo, setBackupInfo] = useAtom(versionBackupInfoAtom);
  const [backupProgress, setBackupProgress] = useAtom(backupProgressAtom);
  const [restoreProgress, setRestoreProgress] = useAtom(restoreProgressAtom);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [versionToRestore, setVersionToRestore] =
    useState<VersionHistoryItem | null>(null);

  // 扫描相关状态
  const [currentScan, setCurrentScan] = useAtom(currentScanAtom);
  const [previousScan, setPreviousScan] = useAtom(previousScanAtom);
  const [changeReport, setChangeReport] = useAtom(changeReportAtom);
  const [scanStatus, setScanStatus] = useAtom(scanStatusAtom);
  const [lastScanTime, setLastScanTime] = useAtom(lastScanTimeAtom);

  // 执行一次扫描
  const performProjectScan = async () => {
    if (!directoryHandle || scanStatus === "scanning") return;

    try {
      setScanStatus("scanning");

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
        const report = compareScans(previousScan, scanResult);
        setChangeReport(report);
      }

      setScanStatus("idle");
    } catch (error) {
      console.error("恢复版本后扫描出错:", error);
      setScanStatus("error");
    }
  };

  // 当打开模态窗时，加载版本历史
  useEffect(() => {
    if (showVersionModal && directoryHandle) {
      loadVersionHistory();
    }
  }, [showVersionModal, directoryHandle]);

  // 加载版本历史
  const loadVersionHistory = async () => {
    if (!directoryHandle) return;

    try {
      const history = await getVersionHistory(directoryHandle);
      setVersionHistory(history);
    } catch (error) {
      console.error("加载版本历史失败:", error);
      setOperationMessage("加载版本历史失败");
      setOperationStatus("error");
    }
  };

  // 创建版本备份
  const handleCreateBackup = async () => {
    if (!directoryHandle) return;

    try {
      setOperationStatus("backing-up");
      setBackupProgress(0);
      setOperationMessage("正在创建版本备份...");

      // 创建备份
      await createVersionBackup(directoryHandle, backupInfo, (progress) => {
        setBackupProgress(progress);
      });

      // 重新加载版本历史
      await loadVersionHistory();

      setOperationMessage("版本备份成功！");
      setBackupInfo(""); // 清空备份信息输入
    } catch (error) {
      console.error("创建版本备份失败:", error);
      setOperationMessage("创建版本备份失败");
      setOperationStatus("error");
    } finally {
      setTimeout(() => {
        setOperationStatus("idle");
        setOperationMessage(null);
      }, 3000);
    }
  };

  // 打开确认恢复对话框
  const handleRestoreVersion = (version: VersionHistoryItem) => {
    setVersionToRestore(version);
    setShowConfirmDialog(true);
  };

  // 确认恢复版本
  const confirmRestore = async () => {
    if (!directoryHandle || !versionToRestore) return;

    try {
      setShowConfirmDialog(false);
      setOperationStatus("restoring");
      setRestoreProgress(0);
      setOperationMessage(
        `正在恢复到版本: ${versionToRestore.versionTitle}...`
      );

      // 恢复版本
      await restoreVersion(
        directoryHandle,
        versionToRestore.folderName,
        (progress) => {
          setRestoreProgress(progress);
        }
      );

      // 恢复成功后立即进行一次扫描
      await performProjectScan();

      setOperationMessage(
        `项目已成功恢复到版本 '${versionToRestore.versionTitle}'！`
      );
    } catch (error) {
      console.error("恢复版本失败:", error);
      setOperationMessage("恢复版本失败");
      setOperationStatus("error");
    } finally {
      setTimeout(() => {
        setOperationStatus("idle");
        setOperationMessage(null);
      }, 3000);
    }
  };

  // 关闭确认对话框
  const cancelRestore = () => {
    setShowConfirmDialog(false);
    setVersionToRestore(null);
  };

  // 格式化时间
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 渲染进度条
  const renderProgressBar = (progress: number) => {
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    );
  };

  // 渲染确认对话框
  const renderConfirmDialog = () => {
    if (!showConfirmDialog || !versionToRestore) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
            警告：此操作无法撤销
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {t("versionManager.confirmRestore")}
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={cancelRestore}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t("versionManager.cancel")}
            </button>
            <button
              onClick={confirmRestore}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              {t("versionManager.confirm")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染版本历史列表
  const renderVersionHistory = () => {
    if (versionHistory.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          暂无版本历史记录
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
        {versionHistory.map((version, index) => (
          <div
            key={index}
            className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {version.versionTitle}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  备份时间: {formatDateTime(version.backupTime)}
                </p>
              </div>
              <button
                onClick={() => handleRestoreVersion(version)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                disabled={operationStatus !== "idle"}
              >
                {t("versionManager.restore")}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染操作状态和消息
  const renderOperationStatus = () => {
    if (!operationMessage) return null;

    return (
      <div className="mb-4 p-3 rounded-md">
        {operationStatus === "backing-up" && (
          <>
            {renderProgressBar(backupProgress)}
            <p className="text-blue-600 dark:text-blue-400">
              {operationMessage} ({backupProgress}%)
            </p>
          </>
        )}
        {operationStatus === "restoring" && (
          <>
            {renderProgressBar(restoreProgress)}
            <p className="text-blue-600 dark:text-blue-400">
              {operationMessage} ({restoreProgress}%)
            </p>
          </>
        )}
        {operationStatus === "error" && (
          <p className="text-red-600 dark:text-red-400">{operationMessage}</p>
        )}
        {operationStatus === "idle" && operationMessage && (
          <p className="text-green-600 dark:text-green-400">
            {operationMessage}
          </p>
        )}
      </div>
    );
  };

  // 渲染版本管理按钮
  const renderVersionButton = () => {
    if (!directoryHandle) return null;

    return (
      <button
        onClick={() => setShowVersionModal(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors dark:bg-purple-700 dark:hover:bg-purple-800"
      >
        {t("versionManager.title")}
      </button>
    );
  };

  // 渲染版本管理模态窗
  const renderVersionModal = () => {
    if (!showVersionModal) return null;

    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] flex flex-col transition-colors duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                {t("versionManager.title")}
              </h3>
              <button
                onClick={() => setShowVersionModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {renderOperationStatus()}

            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
                {t("versionManager.createBackup")}
              </h4>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={backupInfo}
                  onChange={(e) => setBackupInfo(e.target.value)}
                  placeholder={t("versionManager.backupInfo")}
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={operationStatus !== "idle"}
                />
                <button
                  onClick={handleCreateBackup}
                  disabled={operationStatus !== "idle"}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {operationStatus === "backing-up"
                    ? t("versionManager.backingUp")
                    : t("versionManager.backupCurrentVersion")}
                </button>
              </div>
            </div>

            <h4 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
              {t("versionManager.versionHistory")}
            </h4>
            {renderVersionHistory()}
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {renderVersionButton()}
      {renderVersionModal()}
      {renderConfirmDialog()}
    </>
  );
}
