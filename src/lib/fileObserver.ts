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
      return dirHandle.name;
    }
  } catch (e) {
    // 忽略错误，使用备用方法
  }

  // 备用方法：使用路径作为标识
  return dirHandle.name;
}

/**
 * 递归获取目录中的所有子目录句柄
 */
async function getAllSubdirectories(
  dirHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]> {
  const directories: FileSystemDirectoryHandle[] = [];

  try {
    // 遍历当前目录的所有条目
    for await (const [name, handle] of dirHandle.entries()) {
      // 跳过 .fe 版本管理目录
      if (name === ".fe" || name.startsWith(".fe/")) {
        continue;
      }

      // 如果是目录，添加到列表中并递归获取其子目录
      if (handle.kind === "directory") {
        const subdirHandle = handle as FileSystemDirectoryHandle;
        directories.push(subdirHandle);

        // 递归获取子目录
        const subDirectories = await getAllSubdirectories(subdirHandle);
        directories.push(...subDirectories);
      }
    }
  } catch (error) {
    console.error("获取子目录时出错:", error);
  }

  return directories;
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

    // 首先观察根目录
    const rootId = await getDirectoryId(dirHandle);
    if (!observedPaths.has(rootId)) {
      await observer.observe(dirHandle);
      observedPaths.add(rootId);
    }

    // 获取并观察所有子目录
    const subDirectories = await getAllSubdirectories(dirHandle);
    console.log(`正在观察根目录及${subDirectories.length}个子目录的变化`);

    // 计数新观察的目录
    let newObservedCount = 0;

    // 为每个子目录设置观察，使用Promise.all并行处理
    await Promise.all(
      subDirectories.map(async (subDir) => {
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

    // 如果有新观察的目录，输出日志
    if (newObservedCount > 0) {
      console.log(`新增观察了${newObservedCount}个子目录`);
    }

    return true;
  } catch (error) {
    console.error("观察目录变化失败:", error);
    return false;
  }
}
