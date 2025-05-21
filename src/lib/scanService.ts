import { ScanResult, ChangeReport, FileSystemChangeRecord } from "../types";
import {
  createGitignoreFilter,
  scanDirectory,
  generateDiffReport,
  generateTextReport,
  collectCodeStructureInfo,
} from "./scanUtils";
import {
  createFileObserver,
  observeDirectoryChanges,
  observeSingleDirectoryWithSubdirs,
} from "./fileObserver";
import { needReindexAtom, currentScanAtom } from "./store";
import { getDefaultStore } from "jotai";

// 当前活跃的文件系统观察器
let activeObserver: { disconnect(): void } | null = null;

// 获取Jotai store实例
const jotaiStore = getDefaultStore();

// 记录目录结构以便构建文件路径
let directoryStructureCache: Map<string, FileSystemDirectoryHandle> = new Map();

// 本地保存最近的扫描结果，作为备份，防止Jotai状态丢失
let localScanResultBackup: ScanResult | null = null;

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

// 清空目录结构缓存
export function clearDirectoryStructureCache() {
  directoryStructureCache.clear();
  console.log("已清空目录结构缓存");
}

// 初始化目录结构缓存
export async function buildDirectoryStructureCache(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ""
) {
  try {
    // 存储当前目录
    directoryStructureCache.set(path || "/", dirHandle);

    // 遍历子目录
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "directory") {
        const subPath = path ? `${path}/${name}` : name;
        directoryStructureCache.set(
          subPath,
          handle as FileSystemDirectoryHandle
        );
        // 递归处理子目录
        await buildDirectoryStructureCache(
          handle as FileSystemDirectoryHandle,
          subPath
        );
      }
    }

    console.log(`目录结构缓存已更新，共${directoryStructureCache.size}个目录`);
  } catch (error) {
    console.error("构建目录结构缓存时出错:", error);
  }
}

// 尝试获取文件的完整路径
async function getFullFilePath(
  fileHandle: FileSystemFileHandle,
  rootDirHandle: FileSystemDirectoryHandle
): Promise<string | null> {
  try {
    // 尝试直接获取相对路径
    const relativePath = await rootDirHandle.resolve(fileHandle);
    if (relativePath) {
      return relativePath.join("/");
    }
    return fileHandle.name;
  } catch (error) {
    console.error("获取文件完整路径时出错:", error);
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
  dirHandle: FileSystemDirectoryHandle,
  progressCallback?: (progress: number) => void
): Promise<ScanResult> {
  // 创建gitignore过滤器
  const shouldInclude = await createGitignoreFilter(dirHandle);
  const startTime = new Date();
  console.log("开始扫描目录...", startTime.toLocaleString());

  // 从store获取需要重新索引的文件路径和当前扫描结果
  const needReindex = jotaiStore.get(needReindexAtom) || [];
  let currentScan = jotaiStore.get(currentScanAtom);

  // 如果Jotai中没有存储结果，检查本地备份
  if (!currentScan && localScanResultBackup) {
    console.log("从本地备份恢复扫描结果");
    currentScan = localScanResultBackup;
    // 将备份数据同步回Jotai
    jotaiStore.set(currentScanAtom, currentScan);
  }

  console.log(
    `检查是否需要增量扫描，needReindex长度: ${needReindex.length}`,
    needReindex
  );
  console.log("当前扫描结果存在:", currentScan ? "是" : "否");
  if (currentScan) {
    console.log(
      `当前扫描结果包含 ${
        currentScan.entries.length
      } 个条目，时间戳: ${new Date(currentScan.timestamp).toLocaleString()}`
    );
  }

  let entries;

  // 判断是否只需要对变更的文件重新扫描 - 修改判断逻辑，确保即使没有currentScan也能处理通配符
  if (needReindex.length > 0) {
    // 无论是否有当前扫描结果，都检查是否包含通配符标记
    if (needReindex.some((path) => path.startsWith("__CHANGED__:"))) {
      console.log("检测到通配符标记");

      // 过滤掉通配符，只处理具体的文件路径
      const realPaths = needReindex.filter(
        (path) => !path.startsWith("__CHANGED__:")
      );

      // 如果有具体的文件路径
      if (realPaths.length > 0) {
        console.log(
          `过滤后还有 ${realPaths.length} 个具体文件路径需要重新索引`
        );

        // 如果有当前扫描结果，执行增量扫描
        if (currentScan) {
          console.log("有当前扫描结果，将执行增量扫描");
          // 清除通配符，只保留具体路径
          jotaiStore.set(needReindexAtom, realPaths);
        } else {
          console.log("没有当前扫描结果，但有具体文件路径，将执行完整扫描");
          // 执行完整扫描
          entries = await scanDirectory(
            dirHandle,
            shouldInclude,
            "",
            1024 * 1024 * 1,
            progressCallback
          );

          // 扫描完成后更新目录结构缓存
          buildDirectoryStructureCache(dirHandle);

          // 清空需要重新索引的文件列表
          jotaiStore.set(needReindexAtom, []);

          // 提前返回，不执行后续增量扫描代码
          const endTime = new Date();
          const duration = endTime.getTime() - startTime.getTime();
          console.log(`扫描耗时: ${duration} 毫秒`);

          // 收集代码结构信息
          console.log("开始收集代码结构信息...");
          const codeStructure = collectCodeStructureInfo(entries);
          console.log(
            `收集了 ${codeStructure.functions.length} 个函数和方法信息`
          );

          // 创建结果
          const result = {
            entries,
            timestamp: Date.now(),
            codeStructure,
          };

          // 保存到Jotai和本地备份
          jotaiStore.set(currentScanAtom, result);
          localScanResultBackup = result;
          console.log("扫描结果已保存到状态和本地备份");

          // 返回扫描结果
          return result;
        }
      } else {
        // 没有具体文件路径但有通配符，视为轻量级重新扫描
        console.log("没有具体文件路径但有通配符，执行轻量级完整扫描");
        // 清空需要重新索引的文件列表
        jotaiStore.set(needReindexAtom, []);

        // 执行完整扫描但使用较小的进度块，以便更快地显示进度
        entries = await scanDirectory(
          dirHandle,
          shouldInclude,
          "",
          1024 * 1024 * 1,
          progressCallback
        );

        // 扫描完成后更新目录结构缓存
        buildDirectoryStructureCache(dirHandle);

        // 提前返回，不执行后续增量扫描代码
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        console.log(`扫描耗时: ${duration} 毫秒`);

        // 收集代码结构信息
        console.log("开始收集代码结构信息...");
        const codeStructure = collectCodeStructureInfo(entries);
        console.log(
          `收集了 ${codeStructure.functions.length} 个函数和方法信息`
        );

        // 创建结果
        const result = {
          entries,
          timestamp: Date.now(),
          codeStructure,
        };

        // 保存到Jotai和本地备份
        jotaiStore.set(currentScanAtom, result);
        localScanResultBackup = result;
        console.log("扫描结果已保存到状态和本地备份");

        // 返回扫描结果
        return result;
      }
    }

    // 检查是否有当前扫描结果，没有则执行完整扫描
    if (!currentScan) {
      console.log("有需要重新索引的文件但没有现有扫描结果，执行完整扫描");

      entries = await scanDirectory(
        dirHandle,
        shouldInclude,
        "",
        1024 * 1024 * 1,
        progressCallback
      );

      // 扫描完成后更新目录结构缓存
      buildDirectoryStructureCache(dirHandle);

      // 清空需要重新索引的文件列表
      jotaiStore.set(needReindexAtom, []);

      // 不再执行后续增量扫描代码
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      console.log(`扫描耗时: ${duration} 毫秒`);

      // 收集代码结构信息
      console.log("开始收集代码结构信息...");
      const codeStructure = collectCodeStructureInfo(entries);
      console.log(`收集了 ${codeStructure.functions.length} 个函数和方法信息`);

      // 创建结果
      const result = {
        entries,
        timestamp: Date.now(),
        codeStructure,
      };

      // 保存到Jotai和本地备份
      jotaiStore.set(currentScanAtom, result);
      localScanResultBackup = result;
      console.log("扫描结果已保存到状态和本地备份");

      // 返回扫描结果
      return result;
    }

    // 到这里说明有当前扫描结果，且needReindex不为空
    console.log("开始执行真正的增量扫描");

    // 使用上一次的扫描结果
    entries = [...currentScan.entries];
    console.log(`复制现有扫描结果，共 ${entries.length} 个条目`);

    // 记录已处理的文件路径，用于检测删除的文件
    const processedFiles: Set<string> = new Set();

    // 收集需要删除的条目索引
    const indexesToRemove: number[] = [];

    // 先检查是否有需要删除的文件路径标记
    const deletedFiles = needReindex.filter((path) =>
      path.startsWith("__DELETE__:")
    );
    if (deletedFiles.length > 0) {
      console.log(`检测到${deletedFiles.length}个文件需要删除`);

      for (const deletePath of deletedFiles) {
        const path = deletePath.substring("__DELETE__:".length);
        const index = entries.findIndex((entry) => entry.path === path);
        if (index !== -1) {
          console.log(`标记删除文件: ${path}`);
          indexesToRemove.push(index);
          processedFiles.add(path);
        }
      }

      // 按照索引从大到小删除，避免影响其他索引
      indexesToRemove
        .sort((a, b) => b - a)
        .forEach((index) => {
          entries.splice(index, 1);
        });
    }

    // 计划进度总数（用于回调进度更新）
    const totalOperations = needReindex.length;
    let completedOperations = 0;

    // 遍历需要重新索引的文件路径
    for (const filePath of needReindex) {
      // 跳过已标记为删除的文件和通配符
      if (
        filePath.startsWith("__DELETE__:") ||
        filePath.startsWith("__CHANGED__:")
      ) {
        completedOperations++;
        continue;
      }

      try {
        console.log(`重新索引文件: ${filePath}`);
        processedFiles.add(filePath);

        // 构建文件访问路径
        const pathParts = filePath.split("/");
        let currentHandle = dirHandle;
        let currentPath = "";

        // 逐级构建路径
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!part) continue;
          try {
            currentHandle = await currentHandle.getDirectoryHandle(part);
            currentPath += part + "/";
          } catch (e) {
            console.warn(`无法访问目录 ${currentPath}${part}: `, e);
            break;
          }
        }

        // 获取文件句柄
        const fileName = pathParts[pathParts.length - 1];
        try {
          const fileHandle = await currentHandle.getFileHandle(fileName);

          // 获取完整路径
          const fullPath = currentPath + fileName;

          // 检查文件是否应该被包含（根据gitignore规则）
          if (!shouldInclude(fullPath)) {
            console.log(`文件 ${fullPath} 被gitignore规则排除，跳过索引`);

            // 从现有条目中移除该文件
            const index = entries.findIndex((entry) => entry.path === fullPath);
            if (index !== -1) {
              entries.splice(index, 1);
              console.log(`已从扫描结果中移除已排除的文件: ${fullPath}`);
            }

            continue;
          }

          // 获取文件信息
          const file = await fileHandle.getFile();
          const isText =
            file.type.startsWith("text/") ||
            /\.(txt|md|js|jsx|ts|tsx|html|css|json|yml|yaml|xml|svg|sh|bat|ps1)$/i.test(
              file.name
            );

          let content = null as string | null;
          // 如果是文本文件且不超过1MB，则读取内容
          if (isText && file.size <= 1024 * 1024 * 1) {
            content = await file.text();
          }

          // 构建新的文件条目
          const newEntry = {
            type: "file" as const,
            name: file.name,
            path: fullPath,
            size: file.size,
            lastModified: file.lastModified,
            content: content,
          };

          // 查找并替换或添加条目
          const index = entries.findIndex((entry) => entry.path === fullPath);
          if (index !== -1) {
            entries[index] = newEntry;
            console.log(`已更新文件扫描结果: ${fullPath}`);
          } else {
            entries.push(newEntry);
            console.log(`已添加新文件扫描结果: ${fullPath}`);
          }
        } catch (fileError) {
          console.warn(
            `无法访问文件 ${currentPath}${fileName}，可能已被删除: `,
            fileError
          );

          // 从现有条目中移除该文件
          const fullPath = currentPath + fileName;
          const index = entries.findIndex((entry) => entry.path === fullPath);
          if (index !== -1) {
            entries.splice(index, 1);
            console.log(`已从扫描结果中移除不可访问的文件: ${fullPath}`);
          }
        }

        // 更新进度
        completedOperations++;
        if (progressCallback) {
          progressCallback(
            Math.round((completedOperations / totalOperations) * 100)
          );
        }
      } catch (error) {
        console.error(`重新索引文件 ${filePath} 时出错:`, error);
        completedOperations++;
      }
    }

    console.log(
      `已完成${completedOperations}/${needReindex.length}个文件的重新索引`
    );

    // 清空需要重新索引的文件列表
    jotaiStore.set(needReindexAtom, []);
  } else {
    // 正常扫描目录
    console.log("执行完整扫描 (不是增量扫描)");
    console.log("没有需要重新索引的文件，执行完整扫描");

    entries = await scanDirectory(
      dirHandle,
      shouldInclude,
      "",
      1024 * 1024 * 1,
      progressCallback
    );

    // 扫描完成后更新目录结构缓存
    buildDirectoryStructureCache(dirHandle);
  }

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();
  console.log(`扫描耗时: ${duration} 毫秒`);

  // 收集代码结构信息
  console.log("开始收集代码结构信息...");
  const codeStructure = collectCodeStructureInfo(entries);
  console.log(`收集了 ${codeStructure.functions.length} 个函数和方法信息`);

  // 创建结果
  const result = {
    entries,
    timestamp: Date.now(),
    codeStructure,
  };

  // 保存到Jotai和本地备份
  jotaiStore.set(currentScanAtom, result);
  localScanResultBackup = result;
  console.log("扫描结果已保存到状态和本地备份");

  // 返回扫描结果
  return result;
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

    // 初始化目录结构缓存
    await buildDirectoryStructureCache(dirHandle);

    // 尝试使用FileSystemObserver
    const observerCallback = async (
      records: FileSystemChangeRecord[],
      observer: any
    ) => {
      try {
        // 获取当前需要重新索引的文件列表
        const currentNeedReindex = jotaiStore.get(needReindexAtom);
        const newNeedReindex = [...currentNeedReindex];
        let newFilesToReindex = false;

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

        console.log("开始处理文件变更记录...");

        // 检查是否有新创建的文件夹，如果有，立即将其添加到观察列表
        let newDirsObserved = 0;
        for (const record of records) {
          try {
            // 处理文件删除事件
            if (record.type === "deleted") {
              try {
                // 获取被删除文件的路径
                let deletedPath = "";

                // 尝试从观察器中获取被删除的文件路径
                if (record.changedHandle) {
                  deletedPath = record.changedHandle.name;

                  // 如果是文件且被删除，标记为删除
                  if (record.changedHandle.kind === "file") {
                    // 获取当前扫描结果以查找完整路径
                    const currentScan = jotaiStore.get(currentScanAtom);
                    if (currentScan) {
                      // 尝试在现有扫描结果中找到匹配的文件
                      const matchingFiles = currentScan.entries.filter(
                        (entry) =>
                          entry.type === "file" && entry.name === deletedPath
                      );

                      // 如果找到了匹配的文件，将它们全部添加到删除队列
                      if (matchingFiles.length > 0) {
                        for (const file of matchingFiles) {
                          const fullPath = file.path;
                          const deletePath = `__DELETE__:${fullPath}`;

                          if (!newNeedReindex.includes(deletePath)) {
                            console.log(
                              `将已删除文件添加到重新索引队列: ${fullPath}`
                            );
                            newNeedReindex.push(deletePath);
                            newFilesToReindex = true;
                          }
                        }
                      } else {
                        console.log(
                          `无法在现有扫描结果中找到被删除的文件: ${deletedPath}`
                        );
                      }
                    }
                  }
                }
              } catch (e) {
                console.error("处理文件删除事件时出错:", e);
              }
            }

            // 尝试获取文件路径并添加到重新索引队列
            if (record.changedHandle && record.changedHandle.kind === "file") {
              try {
                // 尝试获取完整文件路径
                let filePath = await getFullFilePath(
                  record.changedHandle as FileSystemFileHandle,
                  dirHandle
                );

                if (!filePath) {
                  filePath = record.changedHandle.name;
                  console.log(`无法获取完整路径，使用文件名: ${filePath}`);
                }

                // 检查文件是否被修改或添加
                if (record.type === "modified" || record.type === "added") {
                  if (!newNeedReindex.includes(filePath)) {
                    console.log(`将文件添加到重新索引队列: ${filePath}`);
                    newNeedReindex.push(filePath);
                    newFilesToReindex = true;
                  }
                }
              } catch (e) {
                console.error("处理文件变更时出错:", e);
              }
            }

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

                // 更新目录结构缓存
                await buildDirectoryStructureCache(dirHandle);
              }
            }
          } catch (e) {
            console.error("处理文件变更记录时出错:", e);
          }
        }

        // 如果有新的需要重新索引的文件，更新状态
        if (newFilesToReindex) {
          console.log(
            `更新重新索引队列，现有 ${newNeedReindex.length} 个文件，即将触发扫描`,
            newNeedReindex
          );
          jotaiStore.set(needReindexAtom, newNeedReindex);
        } else {
          console.log("没有检测到需要重新索引的文件");
        }

        if (newDirsObserved > 0) {
          console.log(`总共新增观察了 ${newDirsObserved} 个目录`);
        }

        // 文件变化后，执行回调
        console.log("文件系统变化检测完成，开始执行回调...");
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

  // 清空目录结构缓存
  clearDirectoryStructureCache();
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

// 添加一个直接触发扫描的方法，只处理指定文件路径
export async function performIncrementalScan(
  dirHandle: FileSystemDirectoryHandle,
  filesToReindex: string[],
  progressCallback?: (progress: number) => void
): Promise<ScanResult | null> {
  try {
    console.log(
      `准备执行增量扫描，共有 ${filesToReindex.length} 个文件需要重新索引`
    );

    // 更新需要重新索引的文件队列
    jotaiStore.set(needReindexAtom, filesToReindex);

    // 执行扫描
    return await performScan(dirHandle, progressCallback);
  } catch (error) {
    console.error("执行增量扫描时出错:", error);
    return null;
  }
}
