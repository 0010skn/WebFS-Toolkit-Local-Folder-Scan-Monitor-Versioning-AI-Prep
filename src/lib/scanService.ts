import { ScanResult, ChangeReport, FileSystemChangeRecord } from "../types";
import {
  createGitignoreFilter,
  scanDirectory,
  generateDiffReport,
  generateTextReport,
} from "./scanUtils";
import {
  createFileObserver,
  observeDirectoryChanges,
  observeSingleDirectoryWithSubdirs,
} from "./fileObserver";

// 当前活跃的文件系统观察器
let activeObserver: { disconnect(): void } | null = null;

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
  const startTime = new Date();
  console.log("开始扫描目录...", startTime.toLocaleString());
  // 扫描目录
  const entries = await scanDirectory(dirHandle, shouldInclude);
  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();
  console.log(`扫描耗时: ${duration} 毫秒`);
  // 返回扫描结果
  return {
    entries,
    timestamp: Date.now(),
  };
}

// 启动文件系统监控，使用FileSystemObserver（如果支持）或轮询
export async function startFileSystemMonitoring(
  dirHandle: FileSystemDirectoryHandle,
  onChangeDetected: (isUsingObserver: boolean) => Promise<void>
): Promise<boolean> {
  try {
    // 标记是否是重新初始化
    const isReinitializing = activeObserver !== null;

    // 如果已有活跃的观察器，先断开连接
    if (activeObserver) {
      console.log("断开旧的文件系统观察器连接");
      activeObserver.disconnect();
      activeObserver = null;
    }

    // 尝试使用FileSystemObserver
    const observerCallback = async (
      records: FileSystemChangeRecord[],
      observer: any
    ) => {
      try {
        // 将变化记录中的文件路径输出到控制台（仅开发环境）
        if (process.env.NODE_ENV === "development") {
          const paths = records.map((r) => {
            try {
              return `${r.type}: ${r.changedHandle.name}`;
            } catch (e) {
              return `${r.type}: [无法获取名称]`;
            }
          });
          console.log("检测到文件变化:", paths.join(", "));
        } else {
          console.log(`检测到 ${records.length} 个文件变化`);
        }

        // 检查是否有新创建的文件夹，如果有，立即将其添加到观察列表
        let newDirsObserved = 0;
        for (const record of records) {
          try {
            // 处理"added"或"appeared"类型的事件（浏览器实现可能不一致）
            if (
              (record.type === "added" ||
                (record.type as any) === "appeared") &&
              record.changedHandle.kind === "directory"
            ) {
              console.log(
                `检测到新文件夹: ${record.changedHandle.name}，立即添加到观察列表`
              );

              // 使用新函数观察该目录及其所有子目录
              const dirHandle =
                record.changedHandle as FileSystemDirectoryHandle;
              const count = await observeSingleDirectoryWithSubdirs(
                dirHandle,
                observer
              );

              if (count > 0) {
                console.log(
                  `已将新文件夹 ${dirHandle.name} 及其 ${
                    count - 1
                  } 个子目录添加到观察列表`
                );
                newDirsObserved += count;
              }
            }
          } catch (e) {
            console.error("处理新文件夹时出错:", e);
          }
        }

        if (newDirsObserved > 0) {
          console.log(`总共新增观察了 ${newDirsObserved} 个目录`);
        }

        // 文件变化后，执行回调
        await onChangeDetected(true); // 传入true表示使用的是观察器
      } catch (callbackError) {
        console.error("处理文件变化回调时出错:", callbackError);
      }
    };

    // 保存观察器实例
    console.log("创建新的文件系统观察器...");
    const observer = createFileObserver(observerCallback);
    activeObserver = observer;

    // 尝试启用文件系统观察器
    console.log("开始观察目录变化...");
    const isObserverEnabled = await observeDirectoryChanges(
      dirHandle,
      observerCallback
    );

    if (isObserverEnabled) {
      if (isReinitializing) {
        console.log("已重新初始化文件系统观察器，包含所有子目录");
      } else {
        console.log("已启用文件系统观察器监控，包含所有子目录");
      }
      return true;
    }

    console.log("文件系统观察器不可用，将使用轮询机制");
    return false;
  } catch (error) {
    console.error("启动文件系统监控时出错:", error);
    return false;
  }
}

// 停止文件系统监控
export function stopFileSystemMonitoring(): void {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
    console.log("已停止文件系统监控");
  }
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
  console.log("开始生成扫描报告内容...");

  // 生成报告内容
  const reportText = generateTextReport(report);
  console.log("扫描报告内容已生成，准备下载...");

  // 生成文件名
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(
    2,
    "0"
  )}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `FS_Report_${timestamp}.txt`;

  // 创建Blob对象并生成URL
  const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // 使用浏览器兼容方法
  try {
    // 创建隐藏的链接元素并添加到页面
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.position = "absolute";
    a.style.left = "-9999px";
    a.href = url;
    a.download = filename;

    // 触发点击事件
    a.click();

    // 清理资源
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("扫描报告下载完成");
    }, 1000);
  } catch (error) {
    console.error("下载报告时出错:", error);
    // 使用其他浏览器兼容方法
    const link = document.createElement("a");
    link.href =
      "data:text/plain;charset=utf-8," + encodeURIComponent(reportText);
    link.download = filename;
    link.click();
    console.log("使用其他浏览器兼容方法下载");
  }
}
