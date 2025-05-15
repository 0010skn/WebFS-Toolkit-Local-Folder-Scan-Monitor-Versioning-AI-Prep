import { FileSystemObserverCallback } from "../types";

// 检查浏览器是否支持FileSystemObserver API
export function isFileSystemObserverSupported(): boolean {
  return "FileSystemObserver" in window;
}

// 用于跟踪已观察的目录路径，避免重复观察
const observedPaths = new Set<string>();

/**
 * 创建文件系统观察器
 * 如果浏览器支持FileSystemObserver，则使用原生API
 * 否则返回一个空的观察器，所有方法都是空操作
 */
export function createFileObserver(callback: FileSystemObserverCallback) {
  // 检查浏览器是否支持FileSystemObserver
  if (isFileSystemObserverSupported()) {
    try {
      // 重置已观察路径记录
      observedPaths.clear();

      // @ts-ignore - TypeScript可能不认识这个新的API
      return new window.FileSystemObserver(callback);
    } catch (error) {
      console.error("创建FileSystemObserver失败:", error);
    }
  }

  console.warn("当前浏览器不支持FileSystemObserver API，将使用备用轮询机制");

  // 返回一个空实现，这样调用代码不需要特殊处理
  return {
    async observe(handle: FileSystemHandle): Promise<void> {
      // 不输出日志，避免轮询时过多的控制台输出
      return Promise.resolve();
    },
    disconnect(): void {
      // 不输出日志，避免轮询时过多的控制台输出
    },
  };
}

/**
 * 获取目录的唯一标识，用于避免重复观察
 */
async function getDirectoryId(
  dirHandle: FileSystemDirectoryHandle
): Promise<string> {
  try {
    // 尝试使用浏览器原生API获取唯一ID
    // @ts-ignore - 这是实验性API
    if (dirHandle.isSameEntry && window.crypto && window.crypto.subtle) {
      // 使用更可靠的方式生成ID，结合目录名和创建时间
      const encoder = new TextEncoder();
      const data = encoder.encode(dirHandle.name);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `${dirHandle.name}-${hashHex.substring(0, 8)}`;
    }
  } catch (e) {
    // 忽略错误，使用备用方法
  }

  // 备用方法：使用名称加时间戳作为唯一标识
  return `${dirHandle.name}-${Date.now()}`;
}

/**
 * 递归获取目录中的所有子目录句柄
 * 优化版本：使用更可靠的方式获取所有子目录
 */
async function getAllSubdirectories(
  dirHandle: FileSystemDirectoryHandle,
  maxDepth: number = 1000 // 增加最大深度限制，允许更深层次的递归
): Promise<FileSystemDirectoryHandle[]> {
  const directories: FileSystemDirectoryHandle[] = [];
  const queue: Array<{ handle: FileSystemDirectoryHandle; depth: number }> = [
    { handle: dirHandle, depth: 0 },
  ];

  // 使用广度优先搜索确保能获取所有子目录
  while (queue.length > 0) {
    const { handle: currentDir, depth } = queue.shift()!;

    // 如果达到最大深度，则跳过继续处理
    if (depth >= maxDepth) {
      console.warn(`已达到最大递归深度 ${maxDepth}，跳过更深层的目录`);
      continue;
    }

    try {
      // 遍历当前目录的所有条目
      for await (const [name, handle] of currentDir.entries()) {
        // 跳过 .fe 版本管理目录
        if (
          name === ".fe" ||
          name.startsWith(".fe/") ||
          name === ".git" ||
          name.startsWith(".git/")
        ) {
          continue;
        }

        // 如果是目录，添加到列表中并加入队列以便后续处理
        if (handle.kind === "directory") {
          const subdirHandle = handle as FileSystemDirectoryHandle;
          directories.push(subdirHandle);
          queue.push({ handle: subdirHandle, depth: depth + 1 });

          // 输出调试信息，显示目录深度
          if (process.env.NODE_ENV === "development") {
            console.log(`发现目录: ${name}, 深度: ${depth + 1}`);
          }
        }
      }
    } catch (error) {
      console.error(`获取目录 ${currentDir.name} 的子目录时出错:`, error);
    }
  }

  return directories;
}

/**
 * 观察单个目录及其所有子目录
 * 这个函数用于在检测到新目录时调用
 */
export async function observeSingleDirectoryWithSubdirs(
  dirHandle: FileSystemDirectoryHandle,
  observer: any
): Promise<number> {
  try {
    // 获取目录ID
    const dirId = await getDirectoryId(dirHandle);

    // 如果这个目录已经被观察，则跳过
    if (observedPaths.has(dirId)) {
      return 0;
    }

    // 观察当前目录
    await observer.observe(dirHandle);
    observedPaths.add(dirId);

    // 获取并观察所有子目录
    const subDirectories = await getAllSubdirectories(dirHandle);
    console.log(
      `正在观察新目录 ${dirHandle.name} 及其 ${subDirectories.length} 个子目录`
    );

    // 计数新观察的目录
    let newObservedCount = 1; // 包括当前目录

    // 为每个子目录设置观察
    for (const subDir of subDirectories) {
      const subDirId = await getDirectoryId(subDir);

      // 如果这个子目录还没有被观察，则观察它
      if (!observedPaths.has(subDirId)) {
        await observer.observe(subDir);
        observedPaths.add(subDirId);
        newObservedCount++;
      }
    }

    return newObservedCount;
  } catch (error) {
    console.error(`观察目录 ${dirHandle.name} 及其子目录时出错:`, error);
    return 0;
  }
}

/**
 * 尝试观察目录及其所有子目录的变化
 * 返回一个布尔值，表示是否成功启用了FileSystemObserver
 */
export async function observeDirectoryChanges(
  dirHandle: FileSystemDirectoryHandle,
  callback: FileSystemObserverCallback
): Promise<boolean> {
  // 检查浏览器是否支持FileSystemObserver
  if (!isFileSystemObserverSupported()) {
    return false;
  }

  try {
    const observer = createFileObserver(callback);

    // 每次调用时重置已观察路径,确保能捕获到新创建的文件夹
    observedPaths.clear();

    // 首先观察根目录
    const rootId = await getDirectoryId(dirHandle);
    await observer.observe(dirHandle);
    observedPaths.add(rootId);
    console.log(`已开始观察根目录: ${dirHandle.name}`);

    // 获取并观察所有子目录（使用优化后的函数）
    console.log("正在扫描所有子目录...");
    const startTime = performance.now();
    const subDirectories = await getAllSubdirectories(dirHandle);
    const scanTime = performance.now() - startTime;
    console.log(
      `扫描完成，找到 ${
        subDirectories.length
      } 个子目录，耗时 ${scanTime.toFixed(2)}ms`
    );

    if (subDirectories.length > 0) {
      console.log(`正在观察根目录及${subDirectories.length}个子目录的变化`);

      // 计数新观察的目录
      let newObservedCount = 0;
      let batchSize = 10; // 每批处理的目录数量

      // 分批处理子目录，避免一次性处理太多导致性能问题
      for (let i = 0; i < subDirectories.length; i += batchSize) {
        const batch = subDirectories.slice(i, i + batchSize);

        // 为每个子目录设置观察，使用Promise.all并行处理当前批次
        await Promise.all(
          batch.map(async (subDir) => {
            try {
              const dirId = await getDirectoryId(subDir);

              // 如果这个目录还没有被观察，则观察它
              if (!observedPaths.has(dirId)) {
                await observer.observe(subDir);
                observedPaths.add(dirId);
                newObservedCount++;
              }
            } catch (subError) {
              // 仅在调试模式下记录错误
              if (process.env.NODE_ENV === "development") {
                console.warn(`无法观察子目录 ${subDir.name}:`, subError);
              }
            }
          })
        );

        // 每处理一批，输出进度
        if (i + batchSize < subDirectories.length) {
          console.log(
            `已处理 ${i + batch.length}/${subDirectories.length} 个子目录...`
          );
        }
      }

      // 如果有新观察的目录，输出日志
      if (newObservedCount > 0) {
        console.log(`新增观察了${newObservedCount}个子目录`);
      }
    } else {
      console.log("未找到子目录，仅观察根目录");
    }

    return true;
  } catch (error) {
    console.error("观察目录变化失败:", error);
    return false;
  }
}
