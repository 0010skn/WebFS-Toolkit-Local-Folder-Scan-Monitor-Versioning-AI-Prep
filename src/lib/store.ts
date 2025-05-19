import { atom } from "jotai";
import {
  FileSystemEntry,
  ScanResult,
  ChangeReport,
  ScanStatus,
  VersionHistoryItem,
  OperationStatus,
  Dockerfile,
  EnvFile,
  DockerComposeConfig,
  KnowledgeStoreState,
} from "../types";
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
export const scanStatusAtom = atom<"idle" | "scanning" | "preparing" | "error">(
  "idle"
);

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

// Docker相关状态
export const dockerfilesAtom = atom<Dockerfile>({
  exists: false,
  path: "",
  content: "",
});

export const selectedDockerfileAtom = atom<string>("");
export const dockerfileContentAtom = atom<string>("");
export const parsedDockerfileAtom = atom<Dockerfile | null>(null);
export const dockerfileErrorsAtom = atom<string[]>([]);

// Docker Compose相关状态
export const dockerComposeFilesAtom = atom<{
  exists: boolean;
  paths: string[];
}>({
  exists: false,
  paths: [],
});

export const selectedDockerComposeAtom = atom<string>("");
export const dockerComposeContentAtom = atom<string>("");
export const parsedDockerComposeAtom = atom<DockerComposeConfig | null>(null);
export const dockerComposeErrorsAtom = atom<string[]>([]);

// 环境变量文件相关状态
export const envFilesAtom = atom<{ exists: boolean; paths: string[] }>({
  exists: false,
  paths: [],
});

export const selectedEnvFileAtom = atom<string>("");
export const envFileContentAtom = atom<string>("");
export const parsedEnvFileAtom = atom<EnvFile | null>(null);
export const envFileErrorsAtom = atom<string[]>([]);

// 知识库状态
export const knowledgeStoreAtom = atom<KnowledgeStoreState>({
  entries: [],
  isLoading: false,
  error: null,
  currentEntry: null,
  searchQuery: "",
});

// 知识库模态窗口显示状态
export const knowledgeModalOpenAtom = atom<boolean>(false);

// 知识库条目编辑状态
export const knowledgeEditingAtom = atom<{
  isEditing: boolean;
  entryId: string | null;
  title: string;
  content: string;
}>({
  isEditing: false,
  entryId: null,
  title: "",
  content: "",
});
