// 声明全局类型来避免TypeScript错误
declare interface FileSystemSyncAccessHandle {}

// 文件系统条目类型
export interface FileSystemEntry {
  name: string;
  kind: "file" | "directory";
  path: string;
  lastModified?: number;
  size?: number;
  content?: string;
}

// 扫描结果类型
export interface ScanResult {
  entries: FileSystemEntry[];
  timestamp: number;
}

// 文件变化记录类型
export interface FileSystemChangeRecord {
  type: "added" | "deleted" | "modified" | "renamed" | "appeared";
  changedHandle: FileSystemHandle;
  oldName?: string; // 用于重命名操作
}

// 文件系统观察者类型
export interface FileSystemObserver {
  observe(handle: FileSystemHandle | FileSystemSyncAccessHandle): Promise<void>;
  disconnect(): void;
}

// 文件系统观察者回调函数类型
export type FileSystemObserverCallback = (
  records: FileSystemChangeRecord[],
  observer: FileSystemObserver
) => void;

// 差异类型
export interface FileDiff {
  path: string;
  type: "added" | "deleted" | "modified";
  diff?: string;
  oldContent?: string;
  newContent?: string;
}

// 函数或方法信息
export interface FunctionInfo {
  name: string;
  type: "函数" | "方法" | "类" | "箭头函数";
  lines: [number, number]; // 开始行和结束行
  filePath: string;
  calls: string[]; // 调用的其他函数名称
}

// 变动报告类型
export interface ChangeReport {
  timestamp: number;
  addedFiles: FileSystemEntry[];
  deletedFiles: FileSystemEntry[];
  modifiedFiles: FileDiff[];
  projectStructure: string;
  allFiles?: FileSystemEntry[]; // 添加所有文件的列表，用于显示所有文件内容
  codeStructure?: {
    functions: FunctionInfo[];
    totalFiles: number;
    totalFunctions: number;
    totalMethods: number;
    totalClasses: number;
    totalLines: number;
  };
}

// 版本信息类型
export interface VersionInfo {
  backupTime: string; // ISO 8601 格式的备份时间戳
  versionTitle: string; // 用户提供的版本标题或自动生成的时间戳
}

// 版本历史记录类型
export interface VersionHistoryItem {
  versionTitle: string; // 版本标题
  backupTime: string; // 版本备份时间
  folderName: string; // 版本文件夹名称
}
