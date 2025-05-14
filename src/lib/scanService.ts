import { ScanResult, ChangeReport } from "../types";
import {
  createGitignoreFilter,
  scanDirectory,
  generateDiffReport,
  generateTextReport,
} from "./scanUtils";

// 请求文件夹访问权限
export async function requestDirectoryAccess(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // 请求用户选择文件夹并授权访问
    const dirHandle = await window.showDirectoryPicker({
      mode: "read", // 只读模式
    });

    return dirHandle;
  } catch (error) {
    console.error("获取文件夹访问权限失败:", error);
    return null;
  }
}

// 检查是否存在.gitignore文件并获取其内容
export async function checkGitignoreExists(
  dirHandle: FileSystemDirectoryHandle
): Promise<{ exists: boolean; content: string | null }> {
  try {
    const fileHandle = await dirHandle.getFileHandle(".gitignore", {
      create: false,
    });
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { exists: true, content };
  } catch (error) {
    return { exists: false, content: null };
  }
}

// 执行一次扫描操作
export async function performScan(
  dirHandle: FileSystemDirectoryHandle
): Promise<ScanResult> {
  // 创建gitignore过滤器
  const shouldInclude = await createGitignoreFilter(dirHandle);

  // 扫描目录
  const entries = await scanDirectory(dirHandle, shouldInclude);

  // 返回扫描结果
  return {
    entries,
    timestamp: Date.now(),
  };
}

// 比较扫描结果并生成变动报告
export function compareScans(
  prevScan: ScanResult,
  currScan: ScanResult,
  showAllFiles: boolean = false
): ChangeReport {
  return generateDiffReport(prevScan, currScan, showAllFiles);
}

// 下载文本报告
export function downloadTextReport(report: ChangeReport): void {
  const reportText = generateTextReport(report);
  const blob = new Blob([reportText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `项目扫描报告_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.txt`;
  a.click();

  URL.revokeObjectURL(url);
}
