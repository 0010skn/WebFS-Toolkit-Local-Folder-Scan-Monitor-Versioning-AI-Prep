import { atom } from "jotai";
import { ScanResult, ChangeReport } from "@/types";

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
