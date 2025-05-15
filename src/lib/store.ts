import { atom } from "jotai";
import { ScanResult, ChangeReport, VersionHistoryItem } from "@/types";
import { Locale, getDefaultLocale } from "./i18n";

// 文件夹句柄
export const directoryHandleAtom = atom<FileSystemDirectoryHandle | null>(null);

// 当前扫描结果
export const currentScanAtom = atom<ScanResult | null>(null);

// 上一次扫描结果
export const previousScanAtom = atom<ScanResult | null>(null);

// 当前变动报告
export const changeReportAtom = atom<ChangeReport | null>(null);

// 是否有gitignore
export const hasGitignoreAtom = atom<boolean>(false);

// gitignore内容
export const gitignoreContentAtom = atom<string | null>(null);

// 扫描状态
export const scanStatusAtom = atom<"idle" | "scanning" | "error">("idle");

// 错误信息
export const errorMessageAtom = atom<string | null>(null);

// 是否正在监控
export const isMonitoringAtom = atom<boolean>(false);

// 监控间隔（毫秒）
export const monitorIntervalAtom = atom<number>(5000);

// 上次扫描时间
export const lastScanTimeAtom = atom<number | null>(null);

// 是否显示所有文件内容
export const showAllFilesAtom = atom<boolean>(false);

// 主题模式
export const themeAtom = atom<"light" | "dark">("light");

// 应用语言
export const localeAtom = atom<Locale>(getDefaultLocale());

// 版本管理相关状态
export const versionHistoryAtom = atom<VersionHistoryItem[]>([]);

// 是否显示版本管理模态窗
export const showVersionModalAtom = atom<boolean>(false);

// 是否显示设置模态窗
export const showSettingsModalAtom = atom<boolean>(false);

// 版本管理操作状态
export const versionOperationStatusAtom = atom<
  "idle" | "backing-up" | "restoring" | "error"
>("idle");

// 版本管理操作信息
export const versionOperationMessageAtom = atom<string | null>(null);

// 版本备份信息输入
export const versionBackupInfoAtom = atom<string>("");

// 备份进度
export const backupProgressAtom = atom<number>(0);

// 恢复进度
export const restoreProgressAtom = atom<number>(0);

// README文件内容
export const readmeContentAtom = atom<string | null>(null);
