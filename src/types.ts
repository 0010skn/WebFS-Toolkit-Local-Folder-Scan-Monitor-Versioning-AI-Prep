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

// 差异类型
export interface FileDiff {
  path: string;
  type: "added" | "deleted" | "modified";
  diff?: string;
  oldContent?: string;
  newContent?: string;
}

// 变动报告类型
export interface ChangeReport {
  timestamp: number;
  addedFiles: FileSystemEntry[];
  deletedFiles: FileSystemEntry[];
  modifiedFiles: FileDiff[];
  projectStructure: string;
  allFiles?: FileSystemEntry[]; // 添加所有文件的列表，用于显示所有文件内容
}
