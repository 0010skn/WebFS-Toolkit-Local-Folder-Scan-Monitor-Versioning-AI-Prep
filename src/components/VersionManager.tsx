"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  versionHistoryAtom,
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
  isMonitoringAtom,
} from "../lib/store";
import {
  getVersionHistory,
  createVersionBackup,
  restoreVersion,
  deleteVersion,
} from "../lib/versionService";
import { performScan, compareScans } from "../lib/scanService";
import { VersionHistoryItem } from "../types";
import { useTranslations } from "./LocaleProvider";

interface VersionManagerProps {
  onClose?: () => void;
}

export default function VersionManager({ onClose }: VersionManagerProps) {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [versionHistory, setVersionHistory] = useAtom(versionHistoryAtom);
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
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [versionToDelete, setVersionToDelete] =
    useState<VersionHistoryItem | null>(null);

  // 扫描相关状态
  const [currentScan, setCurrentScan] = useAtom(currentScanAtom);
  const [previousScan, setPreviousScan] = useAtom(previousScanAtom);
  const [changeReport, setChangeReport] = useAtom(changeReportAtom);
  const [scanStatus, setScanStatus] = useAtom(scanStatusAtom);
  const [lastScanTime, setLastScanTime] = useAtom(lastScanTimeAtom);

  // 监控相关状态
  const [isMonitoring, setIsMonitoring] = useAtom(isMonitoringAtom);

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

  // 当组件挂载时，加载版本历史
  useEffect(() => {
    if (directoryHandle) {
      loadVersionHistory();
    }
  }, [directoryHandle]);

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
      // 保存当前监控状态
      const wasMonitoring = isMonitoring;

      // 先暂停监控，避免在备份过程中触发监控
      if (wasMonitoring) {
        setIsMonitoring(false);
      }

      setOperationStatus("backing-up");
      setBackupProgress(0);
      setOperationMessage("正在创建版本备份...");

      // 创建备份
      await createVersionBackup(directoryHandle, backupInfo, (progress) => {
        setBackupProgress(progress);
      });

      // 重新加载版本历史
      await loadVersionHistory();

      // 如果之前正在监控，则恢复监控状态
      if (wasMonitoring) {
        setTimeout(() => {
          setIsMonitoring(true);
        }, 1000); // 延迟1秒恢复监控
      }

      setOperationMessage("版本备份成功！");
      setBackupInfo(""); // 清空备份信息输入
    } catch (error) {
      console.error("创建版本备份失败:", error);
      setOperationMessage("创建版本备份失败");
      setOperationStatus("error");

      // 发生错误时也尝试恢复监控状态
      setTimeout(() => {
        if (isMonitoring === false) {
          setIsMonitoring(true);
        }
      }, 2000);
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
      // 保存当前监控状态
      const wasMonitoring = isMonitoring;

      // 先暂停监控，避免在恢复过程中触发监控
      if (wasMonitoring) {
        setIsMonitoring(false);
      }

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

      // 如果之前正在监控，则恢复监控状态
      if (wasMonitoring) {
        setTimeout(() => {
          setIsMonitoring(true);
        }, 1000); // 延迟1秒恢复监控，确保扫描已完成
      }

      setOperationMessage(
        `项目已成功恢复到版本 '${versionToRestore.versionTitle}'！`
      );
    } catch (error) {
      console.error("恢复版本失败:", error);
      setOperationMessage("恢复版本失败");
      setOperationStatus("error");

      // 发生错误时也尝试恢复监控状态
      setTimeout(() => {
        if (isMonitoring === false) {
          setIsMonitoring(true);
        }
      }, 2000);
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

  // 打开确认删除对话框
  const handleDeleteVersion = (version: VersionHistoryItem) => {
    setVersionToDelete(version);
    setShowDeleteConfirmDialog(true);
  };

  // 确认删除版本
  const confirmDelete = async () => {
    if (!directoryHandle || !versionToDelete) return;

    try {
      // 保存当前监控状态
      const wasMonitoring = isMonitoring;

      // 先暂停监控，避免在删除过程中触发监控
      if (wasMonitoring) {
        setIsMonitoring(false);
      }

      setShowDeleteConfirmDialog(false);
      setOperationStatus("backing-up"); // 复用现有的状态，表示正在操作中
      setOperationMessage(`正在删除版本: ${versionToDelete.versionTitle}...`);

      // 删除版本
      await deleteVersion(directoryHandle, versionToDelete.folderName);

      // 重新加载版本历史
      await loadVersionHistory();

      // 如果之前正在监控，则恢复监控状态
      if (wasMonitoring) {
        setTimeout(() => {
          setIsMonitoring(true);
        }, 1000); // 延迟1秒恢复监控
      }

      setOperationMessage(
        `版本 '${versionToDelete.versionTitle}' 已成功删除！`
      );
    } catch (error) {
      console.error("删除版本失败:", error);
      setOperationMessage("删除版本失败");
      setOperationStatus("error");

      // 发生错误时也尝试恢复监控状态
      setTimeout(() => {
        if (isMonitoring === false) {
          setIsMonitoring(true);
        }
      }, 2000);
    } finally {
      setTimeout(() => {
        setOperationStatus("idle");
        setOperationMessage(null);
      }, 3000);
    }
  };

  // 关闭确认删除对话框
  const cancelDelete = () => {
    setShowDeleteConfirmDialog(false);
    setVersionToDelete(null);
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

  if (!directoryHandle) return null;

  return (
    <div
      className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl"
      style={{
        maxWidth: "800px",
        width: "100%",
        maxHeight: "90vh",
        overflow: "auto",
        position: "relative",
        zIndex: 10000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 模态窗口内容 */}
      <div className="p-6">
        {/* 顶部：标题和关闭按钮 */}
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {t("versionManager.title")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        {/* 操作状态提示 */}
        {operationMessage && (
          <div
            className={`mb-4 p-3 rounded-md ${
              operationStatus === "error"
                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                : operationStatus === "idle"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
            }`}
          >
            {(operationStatus === "backing-up" ||
              operationStatus === "restoring") && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      operationStatus === "backing-up"
                        ? backupProgress
                        : restoreProgress
                    }%`,
                  }}
                ></div>
              </div>
            )}
            <p>
              {operationMessage}
              {(operationStatus === "backing-up" ||
                operationStatus === "restoring") &&
                ` (${Math.round(
                  operationStatus === "backing-up"
                    ? backupProgress
                    : restoreProgress
                )}%)`}
            </p>
          </div>
        )}

        {/* 创建备份区域 */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <h3 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">
            {t("versionManager.createBackup")}
          </h3>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={backupInfo}
              onChange={(e) => setBackupInfo(e.target.value)}
              placeholder={t("versionManager.backupInfo")}
              className="w-full sm:flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={operationStatus !== "idle"}
            />
            <button
              onClick={handleCreateBackup}
              disabled={operationStatus !== "idle"}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {operationStatus === "backing-up"
                ? t("versionManager.backingUp")
                : t("versionManager.backupCurrentVersion")}
            </button>
          </div>
        </div>

        {/* 版本历史区域 */}
        <h3 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">
          {t("versionManager.versionHistory")}
        </h3>

        {versionHistory.length === 0 ? (
          <div className="text-center p-6 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-gray-500 dark:text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <p>暂无版本历史记录</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg overflow-hidden">
            {versionHistory.map((version, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="sm:flex justify-between items-start">
                  <div className="mb-2 sm:mb-0">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {version.versionTitle}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      备份时间: {formatDateTime(version.backupTime)}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-1 sm:mt-0">
                    <button
                      onClick={() => handleRestoreVersion(version)}
                      disabled={operationStatus !== "idle"}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("versionManager.restore")}
                    </button>
                    <button
                      onClick={() => handleDeleteVersion(version)}
                      disabled={operationStatus !== "idle"}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 确认恢复对话框 */}
      {showConfirmDialog && versionToRestore && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black opacity-60"
            onClick={cancelRestore}
          ></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 m-4 w-full max-w-md z-[10002]">
            <div className="mb-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-center text-red-600 dark:text-red-400 mb-2">
                警告：此操作无法撤销
              </h3>
              <p className="text-center text-gray-700 dark:text-gray-300">
                {t("versionManager.confirmRestore")}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={cancelRestore}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t("versionManager.cancel")}
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                {t("versionManager.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认删除对话框 */}
      {showDeleteConfirmDialog && versionToDelete && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black opacity-60"
            onClick={cancelDelete}
          ></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 m-4 w-full max-w-md z-[10002]">
            <div className="mb-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-center text-red-600 dark:text-red-400 mb-2">
                确认删除
              </h3>
              <p className="text-center text-gray-700 dark:text-gray-300">
                您确定要删除版本 "{versionToDelete.versionTitle}"
                吗？此操作无法撤销。
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
