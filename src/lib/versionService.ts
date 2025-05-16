import { VersionInfo, VersionHistoryItem, FileSystemEntry } from "../types";
import { createGitignoreFilter } from "./scanUtils";

// 获取或创建 .fe 隐藏文件夹
export async function getOrCreateVersionFolder(
  rootHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  try {
    // 尝试获取已存在的 .fe 文件夹
    return await rootHandle.getDirectoryHandle(".fe", { create: false });
  } catch (error) {
    // 如果不存在，则创建一个新的 .fe 文件夹
    console.log("创建 .fe 文件夹用于版本管理");
    return await rootHandle.getDirectoryHandle(".fe", { create: true });
  }
}

// 获取当前时间戳，格式为 YYYYMMDD_HHmmss
function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// 创建版本备份 - 优化版本
export async function createVersionBackup(
  rootHandle: FileSystemDirectoryHandle,
  versionTitle: string = "",
  progressCallback: (progress: number) => void = () => {}
): Promise<string> {
  try {
    // 获取.fe文件夹
    const feHandle = await getOrCreateVersionFolder(rootHandle);

    // 始终使用时间戳作为文件夹名称，确保唯一性
    const folderName = getCurrentTimestamp();

    // 创建版本文件夹
    const versionFolderHandle = await feHandle.getDirectoryHandle(folderName, {
      create: true,
    });

    // 创建版本信息对象
    const versionInfo: VersionInfo = {
      backupTime: new Date().toISOString(),
      versionTitle: versionTitle.trim() || folderName,
    };

    // 写入版本信息文件
    const versionInfoFile = await versionFolderHandle.getFileHandle(
      "version_info.json",
      { create: true }
    );
    const writable = await versionInfoFile.createWritable();
    await writable.write(JSON.stringify(versionInfo, null, 2));
    await writable.close();

    // 创建.gitignore过滤器
    const shouldInclude = await createGitignoreFilter(rootHandle);

    // 使用优化的并行备份函数
    await parallelBackupFiles(
      rootHandle,
      versionFolderHandle,
      shouldInclude,
      progressCallback
    );

    // 确保最后的进度是100%
    progressCallback(100);

    return folderName;
  } catch (error) {
    console.error("创建版本备份时出错:", error);
    throw error;
  }
}

// 并行备份文件 - 使用工作队列和批处理提高性能
async function parallelBackupFiles(
  sourceHandle: FileSystemDirectoryHandle,
  targetHandle: FileSystemDirectoryHandle,
  shouldInclude: (path: string) => boolean,
  progressCallback: (progress: number) => void = () => {}
): Promise<void> {
  const MAX_CONCURRENT_TASKS = 8; // 最大并行任务数
  const BATCH_SIZE = 20; // 每批处理的文件数

  // 文件队列
  interface QueueItem {
    sourceHandle: FileSystemDirectoryHandle | FileSystemFileHandle;
    targetPath: string[];
    isDirectory: boolean;
  }

  const queue: QueueItem[] = [];
  let activeWorkers = 0;
  let totalFiles = 0;
  let processedFiles = 0;

  // 首先计算文件总数，但使用更高效的方法
  console.time("计算文件总数");
  totalFiles = await fastCountFiles(sourceHandle, shouldInclude);
  console.timeEnd("计算文件总数");
  console.log(`需要备份的文件总数: ${totalFiles}`);

  // 将根目录添加到队列
  queue.push({
    sourceHandle,
    targetPath: [],
    isDirectory: true,
  });

  // 处理队列中的项目
  while (queue.length > 0 || activeWorkers > 0) {
    // 如果有空闲工作槽位且队列中有项目，则处理下一批
    while (activeWorkers < MAX_CONCURRENT_TASKS && queue.length > 0) {
      // 获取一批任务
      const batch = queue.splice(0, Math.min(BATCH_SIZE, queue.length));
      activeWorkers++;

      // 异步处理批次
      processItemBatch(batch)
        .then(() => {
          activeWorkers--;
        })
        .catch((error) => {
          console.error("处理批次时出错:", error);
          activeWorkers--;
        });
    }

    // 如果队列不为空或有活动工作线程，等待一小段时间
    if (queue.length > 0 || activeWorkers > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // 处理一批队列项
  async function processItemBatch(items: QueueItem[]): Promise<void> {
    await Promise.all(
      items.map(async (item) => {
        if (item.isDirectory) {
          // 处理目录
          const dirHandle = item.sourceHandle as FileSystemDirectoryHandle;

          // 如果不是根目录，创建目标目录
          let targetDirHandle = targetHandle;
          if (item.targetPath.length > 0) {
            for (const pathPart of item.targetPath) {
              targetDirHandle = await targetDirHandle.getDirectoryHandle(
                pathPart,
                { create: true }
              );
            }
          }

          // 读取目录内容
          const entries: [string, FileSystemHandle][] = [];
          try {
            for await (const entry of dirHandle.entries()) {
              entries.push(entry);
            }
          } catch (error) {
            console.error(
              `读取目录 ${item.targetPath.join("/")} 内容时出错:`,
              error
            );
            return;
          }

          // 处理目录内容
          for (const [name, handle] of entries) {
            // 跳过 .fe 和 .git 目录
            if (name === ".fe" || name === ".git") continue;

            // 构建路径
            const path =
              item.targetPath.length > 0
                ? `${item.targetPath.join("/")}/${name}`
                : name;

            // 检查是否应该包含此文件或文件夹
            if (!shouldInclude(path)) continue;

            // 添加到队列
            queue.push({
              sourceHandle:
                handle.kind === "directory"
                  ? (handle as FileSystemDirectoryHandle)
                  : (handle as FileSystemFileHandle),
              targetPath: [...item.targetPath, name],
              isDirectory: handle.kind === "directory",
            });
          }
        } else {
          // 处理文件
          try {
            const fileHandle = item.sourceHandle as FileSystemFileHandle;
            const file = await fileHandle.getFile();

            // 创建目标文件的目录结构
            let currentTargetHandle = targetHandle;
            const dirPath = item.targetPath.slice(0, -1);
            const fileName = item.targetPath[item.targetPath.length - 1];

            for (const pathPart of dirPath) {
              currentTargetHandle =
                await currentTargetHandle.getDirectoryHandle(pathPart, {
                  create: true,
                });
            }

            // 创建并写入文件
            const targetFileHandle = await currentTargetHandle.getFileHandle(
              fileName,
              { create: true }
            );
            const writable = await targetFileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            // 更新进度
            processedFiles++;
            const progress = Math.min(
              Math.round((processedFiles / totalFiles) * 100),
              99
            );
            progressCallback(progress);
          } catch (error) {
            console.error(
              `备份文件 ${item.targetPath.join("/")} 时出错:`,
              error
            );
          }
        }
      })
    );
  }
}

// 快速计算文件数量 - 使用并行处理提高速度
async function fastCountFiles(
  dirHandle: FileSystemDirectoryHandle,
  shouldInclude: (path: string) => boolean
): Promise<number> {
  const MAX_CONCURRENT_TASKS = 8;
  let count = 0;
  let activeWorkers = 0;

  interface DirQueueItem {
    handle: FileSystemDirectoryHandle;
    path: string;
  }

  const dirQueue: DirQueueItem[] = [{ handle: dirHandle, path: "" }];

  while (dirQueue.length > 0 || activeWorkers > 0) {
    while (activeWorkers < MAX_CONCURRENT_TASKS && dirQueue.length > 0) {
      const nextDir = dirQueue.shift()!;
      activeWorkers++;

      countFilesInDir(nextDir.handle, nextDir.path)
        .then((result) => {
          count += result.fileCount;
          dirQueue.push(...result.subDirs);
          activeWorkers--;
        })
        .catch((error) => {
          console.error(`计算目录 ${nextDir.path} 的文件数时出错:`, error);
          activeWorkers--;
        });
    }

    if (dirQueue.length > 0 || activeWorkers > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return count;

  // 计算单个目录中的文件数
  async function countFilesInDir(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string
  ): Promise<{ fileCount: number; subDirs: DirQueueItem[] }> {
    let fileCount = 0;
    const subDirs: DirQueueItem[] = [];

    try {
      for await (const [name, handle] of dirHandle.entries()) {
        // 跳过 .fe 和 .git 目录
        if (name === ".fe" || name === ".git") continue;

        const path = currentPath ? `${currentPath}/${name}` : name;

        // 检查是否应该包含此文件或文件夹
        if (!shouldInclude(path)) continue;

        if (handle.kind === "file") {
          fileCount++;
        } else if (handle.kind === "directory") {
          subDirs.push({ handle: handle as FileSystemDirectoryHandle, path });
        }
      }
    } catch (error) {
      console.error(`计算目录 ${currentPath} 的文件数时出错:`, error);
    }

    return { fileCount, subDirs };
  }
}

// 读取版本历史
export async function getVersionHistory(
  rootHandle: FileSystemDirectoryHandle
): Promise<VersionHistoryItem[]> {
  try {
    // 获取.fe文件夹
    const feHandle = await getOrCreateVersionFolder(rootHandle);

    const versions: VersionHistoryItem[] = [];

    // 遍历.fe下的所有子文件夹
    for await (const [name, handle] of feHandle.entries()) {
      if (handle.kind === "directory") {
        try {
          // 读取版本信息文件
          const dirHandle = handle as FileSystemDirectoryHandle;
          const versionInfoFileHandle = await dirHandle.getFileHandle(
            "version_info.json",
            { create: false }
          );
          const versionInfoFile = await versionInfoFileHandle.getFile();
          const versionInfoText = await versionInfoFile.text();
          const versionInfo: VersionInfo = JSON.parse(versionInfoText);

          versions.push({
            versionTitle: versionInfo.versionTitle,
            backupTime: versionInfo.backupTime,
            folderName: name,
          });
        } catch (error) {
          console.error(`读取版本 ${name} 的信息时出错:`, error);
        }
      }
    }

    // 按照备份时间降序排序
    return versions.sort(
      (a, b) =>
        new Date(b.backupTime).getTime() - new Date(a.backupTime).getTime()
    );
  } catch (error) {
    console.error("读取版本历史时出错:", error);
    return [];
  }
}

// 递归获取目录中的所有文件和子目录，确保捕获所有层级的文件夹
async function getAllFilesAndDirs(
  dirHandle: FileSystemDirectoryHandle,
  currentPath: string = "",
  excludePatterns: string[] = [".fe", ".git", ".next", "node_modules"]
): Promise<{ files: string[]; dirs: string[] }> {
  const files: string[] = [];
  const dirs: string[] = [];

  try {
    // 先添加当前目录（如果不是根目录，且不在排除列表中）
    if (
      currentPath &&
      !excludePatterns.some(
        (pattern) =>
          currentPath === pattern || currentPath.startsWith(`${pattern}/`)
      )
    ) {
      dirs.push(currentPath);
    }

    // 遍历目录中的所有项目
    for await (const [name, handle] of dirHandle.entries()) {
      // 排除特定文件和目录
      if (name === "version_info.json") continue;

      const path = currentPath ? `${currentPath}/${name}` : name;

      // 检查是否应该排除此路径
      if (
        excludePatterns.some(
          (pattern) => path === pattern || path.startsWith(`${pattern}/`)
        )
      ) {
        continue;
      }

      if (handle.kind === "file") {
        files.push(path);
      } else if (handle.kind === "directory") {
        // 递归处理子目录
        const subDirHandle = handle as FileSystemDirectoryHandle;
        const subResults = await getAllFilesAndDirs(
          subDirHandle,
          path,
          excludePatterns
        );

        // 合并结果
        files.push(...subResults.files);
        dirs.push(...subResults.dirs);
      }
    }
  } catch (error) {
    console.error(`获取目录 ${currentPath} 的内容时出错:`, error);
  }

  return { files, dirs };
}

// 恢复版本 - 超级优化版本
export async function restoreVersion(
  rootHandle: FileSystemDirectoryHandle,
  versionFolderName: string,
  progressCallback: (progress: number) => void = () => {}
): Promise<void> {
  try {
    console.log("开始恢复版本:", versionFolderName);

    // 获取.fe文件夹
    const feHandle = await getOrCreateVersionFolder(rootHandle);

    // 获取指定版本的文件夹
    const versionFolderHandle = await feHandle.getDirectoryHandle(
      versionFolderName,
      { create: false }
    );

    // 更新进度：2% - 初始化
    progressCallback(2);

    // 对于错误日志和调试信息
    const errors: string[] = [];
    let hasErrors = false;

    // 排除特定目录
    const exclusionPatterns = [".fe", ".git", ".next", "node_modules"];

    // 获取项目文件和版本文件的完整信息
    console.time("获取文件和目录列表");
    let projectFilesAndDirs, versionFilesAndDirs;

    try {
      // 获取当前项目的所有文件和目录（排除特定目录）
      projectFilesAndDirs = await getAllFilesAndDirs(
        rootHandle,
        "",
        exclusionPatterns
      );
      console.log(
        `当前项目文件数: ${projectFilesAndDirs.files.length}, 目录数: ${projectFilesAndDirs.dirs.length}`
      );

      // 获取版本的所有文件和目录（不排除任何目录，因为我们需要完整的版本内容）
      versionFilesAndDirs = await getAllFilesAndDirs(
        versionFolderHandle,
        "",
        []
      );
      console.log(
        `版本文件数: ${versionFilesAndDirs.files.length}, 目录数: ${versionFilesAndDirs.dirs.length}`
      );
    } catch (error) {
      console.error("获取文件和目录列表失败:", error);
      hasErrors = true;
      errors.push(`获取文件和目录列表失败: ${error}`);
      throw new Error(`无法获取完整的文件和目录列表: ${error}`);
    }
    console.timeEnd("获取文件和目录列表");

    // 记录文件列表日志，帮助调试
    console.log("项目目录:", projectFilesAndDirs.dirs);
    console.log("版本目录:", versionFilesAndDirs.dirs);

    if (versionFilesAndDirs.files.length === 0) {
      throw new Error("版本文件为空，无法恢复");
    }

    // 更新进度：8% - 文件列表获取完成
    progressCallback(8);

    // 计算需要删除的文件
    const filesToDelete = projectFilesAndDirs.files.filter(
      (file) => !versionFilesAndDirs.files.includes(file)
    );

    // 需要删除的目录（需要从最深层的子目录开始删除）
    const dirsToDelete = projectFilesAndDirs.dirs
      .filter((dir) => !versionFilesAndDirs.dirs.includes(dir))
      .sort((a, b) => {
        // 按目录深度降序排序（最深层的目录排在前面）
        return b.split("/").length - a.split("/").length;
      });

    // 需要创建的目录（需要从最浅层的目录开始创建）
    const dirsToCreate = versionFilesAndDirs.dirs
      .filter((dir) => !projectFilesAndDirs.dirs.includes(dir))
      .sort((a, b) => {
        // 按目录深度升序排序（最浅层的目录排在前面）
        return a.split("/").length - b.split("/").length;
      });

    // 需要复制的文件
    const filesToCopy = versionFilesAndDirs.files;

    // 计算总操作数并分配进度权重
    const deleteWeight = 0.1; // 删除操作占10%进度
    const createDirsWeight = 0.1; // 创建目录占10%进度
    const copyWeight = 0.7; // 复制操作占70%进度
    // 初始化占8%，最终完成时会达到100%

    // 打印操作计划，帮助调试
    console.log("要删除的文件:", filesToDelete.length, filesToDelete);
    console.log("要删除的目录:", dirsToDelete.length, dirsToDelete);
    console.log("要创建的目录:", dirsToCreate.length, dirsToCreate);
    console.log("要复制的文件:", filesToCopy.length);

    // 对文件进行排序，小文件优先处理提高用户感知速度
    filesToCopy.sort((a, b) => {
      try {
        // 优先处理文本文件和小文件
        const extensionA = a.split(".").pop()?.toLowerCase() || "";
        const extensionB = b.split(".").pop()?.toLowerCase() || "";

        // 文本类文件优先级高
        const textExtensions = [
          "txt",
          "js",
          "ts",
          "jsx",
          "tsx",
          "json",
          "css",
          "scss",
          "html",
          "md",
        ];
        const isTextA = textExtensions.includes(extensionA);
        const isTextB = textExtensions.includes(extensionB);

        if (isTextA && !isTextB) return -1;
        if (!isTextA && isTextB) return 1;

        // 同类型文件按路径长度排序，短路径优先
        return a.length - b.length;
      } catch {
        return 0;
      }
    });

    // 使用增强版并行删除文件
    console.time("删除文件");
    try {
      await enhancedParallelDeleteFiles(
        rootHandle,
        filesToDelete,
        (deletedCount) => {
          const deleteProgress =
            (deletedCount / Math.max(filesToDelete.length, 1)) * deleteWeight;
          const progress = Math.round((0.08 + deleteProgress) * 100);
          progressCallback(progress);
        }
      );
    } catch (error) {
      console.error("删除文件过程中出错:", error);
      hasErrors = true;
      errors.push(`删除文件过程中出错: ${error}`);
      // 继续执行其他操作
    }
    console.timeEnd("删除文件");

    // 删除空目录
    console.time("删除目录");
    let deletedDirCount = 0;
    try {
      for (const dirPath of dirsToDelete) {
        try {
          await deleteEmptyDirectory(rootHandle, dirPath);
          deletedDirCount++;

          // 更新进度
          const deleteProgress =
            (deletedDirCount / Math.max(dirsToDelete.length, 1)) * deleteWeight;
          const progress = Math.round((0.18 + deleteProgress) * 100);
          progressCallback(progress);
        } catch (error) {
          console.warn(`删除目录 ${dirPath} 时出错:`, error);
        }
      }
    } catch (error) {
      console.error("删除目录过程中出错:", error);
      hasErrors = true;
      errors.push(`删除目录过程中出错: ${error}`);
    }
    console.timeEnd("删除目录");

    // 确保所有目录都存在
    console.time("创建目录");
    const createdDirs = new Set<string>();

    // 先确保所有必要的目录都创建好
    for (const dirPath of dirsToCreate) {
      try {
        await createNestedDirectories(rootHandle, dirPath, createdDirs);
      } catch (error) {
        console.warn(`创建目录 ${dirPath} 时出错:`, error);
        hasErrors = true;
        errors.push(`创建目录 ${dirPath} 失败: ${error}`);
      }
    }

    // 再确保所有文件的父目录都创建好
    for (const filePath of filesToCopy) {
      try {
        const pathParts = filePath.split("/");
        pathParts.pop(); // 移除文件名，只保留目录路径

        if (pathParts.length > 0) {
          const dirPath = pathParts.join("/");
          await createNestedDirectories(rootHandle, dirPath, createdDirs);
        }
      } catch (error) {
        console.warn(`为文件 ${filePath} 创建父目录时出错:`, error);
      }
    }

    console.timeEnd("创建目录");
    progressCallback(40); // 目录准备完成

    // 使用增强版并行复制文件
    console.time("复制文件");
    try {
      await enhancedParallelCopyFiles(
        versionFolderHandle,
        rootHandle,
        filesToCopy,
        (copiedCount) => {
          const copyProgress =
            (copiedCount / Math.max(filesToCopy.length, 1)) * copyWeight;
          const progress = Math.round((0.4 + copyProgress) * 100);
          progressCallback(Math.min(progress, 99)); // 限制最大进度为99%
        }
      );
    } catch (error) {
      console.error("复制文件过程中出错:", error);
      hasErrors = true;
      errors.push(`复制文件过程中出错: ${error}`);
    }
    console.timeEnd("复制文件");

    // 最终处理
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 如果有错误，显示在控制台，但不阻止恢复过程
    if (hasErrors) {
      console.warn("恢复过程中发生以下错误:");
      errors.forEach((error) => console.warn(`- ${error}`));
      console.warn("恢复已完成，但可能不完整。");
    }

    // 更新进度：100% - 恢复完成
    progressCallback(100);
    console.log("版本恢复完成:", versionFolderName);
  } catch (error) {
    console.error("恢复版本时出错:", error);
    throw error;
  }
}

// 创建嵌套目录 - 确保创建完整的目录结构
async function createNestedDirectories(
  rootHandle: FileSystemDirectoryHandle,
  dirPath: string,
  createdDirs: Set<string>
): Promise<void> {
  if (!dirPath) return;

  const pathParts = dirPath.split("/").filter((part) => part.trim() !== "");
  if (pathParts.length === 0) return;

  let currentHandle = rootHandle;
  let currentPath = "";

  // 逐级创建目录
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (!part || part === ".") continue; // 跳过空部分或当前目录符号

    currentPath = currentPath ? `${currentPath}/${part}` : part;

    // 如果已经创建过这个目录，尝试获取
    if (createdDirs.has(currentPath)) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: false,
        });
        continue;
      } catch (error) {
        console.log(`已标记为创建但无法获取目录: ${currentPath}, 将重新创建`);
        // 从集合中移除，以便重新创建
        createdDirs.delete(currentPath);
      }
    }

    // 尝试创建或获取目录
    try {
      try {
        // 先尝试获取现有目录
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: false,
        });
        console.log(`已存在目录: ${currentPath}`);
      } catch (getError) {
        // 如果获取失败，尝试创建
        console.log(`尝试创建目录: ${currentPath}`);
        try {
          currentHandle = await currentHandle.getDirectoryHandle(part, {
            create: true,
          });
          console.log(`成功创建目录: ${currentPath}`);
        } catch (createError) {
          console.error(`创建目录失败 ${currentPath}:`, createError);
          throw new Error(`无法创建目录 ${currentPath}: ${createError}`);
        }
      }

      // 标记为已创建
      createdDirs.add(currentPath);
    } catch (error) {
      console.error(`处理目录时发生错误 ${currentPath}:`, error);
      throw new Error(`处理目录失败 ${currentPath}: ${error}`);
    }
  }
}

// 增强版复制文件 - 确保目标目录存在
async function enhancedCopyFile(
  sourceRootHandle: FileSystemDirectoryHandle,
  targetRootHandle: FileSystemDirectoryHandle,
  filePath: string,
  createdDirs: Set<string>
): Promise<void> {
  try {
    const pathParts = filePath.split("/");
    const fileName = pathParts.pop()!;
    const dirPath = pathParts.join("/");

    // 获取源文件句柄
    let sourceFileHandle;
    try {
      // 获取源文件的句柄
      let currentHandle = sourceRootHandle;
      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: false,
        });
      }
      sourceFileHandle = await currentHandle.getFileHandle(fileName);
    } catch (error) {
      console.warn(`无法获取源文件句柄 ${filePath}: ${error}`);
      throw new Error(`源文件 ${filePath} 不存在或无法访问`);
    }

    // 确保目标目录存在
    let targetDirHandle;
    try {
      // 确保所有父目录都存在
      await createNestedDirectories(targetRootHandle, dirPath, createdDirs);

      // 获取最终目标目录
      targetDirHandle = targetRootHandle;
      for (const part of pathParts) {
        targetDirHandle = await targetDirHandle.getDirectoryHandle(part, {
          create: false,
        });
      }
    } catch (error) {
      console.warn(`无法获取或创建目标目录 ${dirPath}: ${error}`);
      throw new Error(`无法获取或创建目标目录 ${dirPath}: ${error}`);
    }

    // 读取源文件并写入目标文件
    try {
      const sourceFile = await sourceFileHandle.getFile();
      const targetFileHandle = await targetDirHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await targetFileHandle.createWritable();

      // 对于大文件使用流式写入，小文件一次性写入
      if (sourceFile.size > 1024 * 1024) {
        // 大于1MB的文件
        // 流式写入大文件
        const reader = sourceFile.stream().getReader();
        let result;
        while (!(result = await reader.read()).done) {
          if (result.value) {
            await writable.write(result.value);
          }
        }
      } else {
        // 一次性写入小文件
        await writable.write(sourceFile);
      }

      await writable.close();
    } catch (error) {
      console.warn(`写入文件 ${filePath} 失败: ${error}`);
      throw error;
    }
  } catch (error) {
    console.warn(`复制文件 ${filePath} 失败: ${error}`);
    throw error; // 向上抛出错误，让调用者处理
  }
}

// 增强版并行删除文件 - 使用动态并发数和批处理
async function enhancedParallelDeleteFiles(
  rootHandle: FileSystemDirectoryHandle,
  filesToDelete: string[],
  progressCallback: (deletedCount: number) => void = () => {}
): Promise<void> {
  // 动态调整并发数 - 基于文件数量
  const MAX_CONCURRENT_TASKS = Math.min(
    32,
    Math.max(8, Math.floor(filesToDelete.length / 20))
  );
  // 批处理大小
  const BATCH_SIZE = Math.min(
    50,
    Math.max(10, Math.floor(filesToDelete.length / 10))
  );

  let activeWorkers = 0;
  let deletedCount = 0;
  let lastProgressUpdate = Date.now();

  // 按批次处理
  const batches: string[][] = [];
  for (let i = 0; i < filesToDelete.length; i += BATCH_SIZE) {
    batches.push(filesToDelete.slice(i, i + BATCH_SIZE));
  }

  // 并行处理批次
  const batchPromises: Promise<void>[] = [];

  for (const batch of batches) {
    // 等待有空闲工作槽位
    while (activeWorkers >= MAX_CONCURRENT_TASKS) {
      await new Promise((resolve) => setTimeout(resolve, 2)); // 减少等待时间
    }

    activeWorkers++;

    // 异步处理批次
    const batchPromise = (async (fileBatch) => {
      try {
        await Promise.all(
          fileBatch.map(async (file) => {
            try {
              await deleteFileRecursively(rootHandle, file);
              deletedCount++;

              // 降低进度更新频率，提高性能
              const now = Date.now();
              if (now - lastProgressUpdate > 50) {
                // 每50ms最多更新一次
                progressCallback(deletedCount);
                lastProgressUpdate = now;
              }
            } catch (error) {
              console.warn(`删除文件 ${file} 时出错:`, error);
              // 记录但不抛出错误，继续处理其他文件
            }
          })
        );
      } finally {
        activeWorkers--;
        progressCallback(deletedCount);
      }
    })(batch);

    batchPromises.push(batchPromise);
  }

  // 等待所有批次完成
  await Promise.allSettled(batchPromises);
  progressCallback(deletedCount);
}

// 增强版并行复制文件 - 使用动态并发数和优先级队列
async function enhancedParallelCopyFiles(
  sourceRootHandle: FileSystemDirectoryHandle,
  targetRootHandle: FileSystemDirectoryHandle,
  filesToCopy: string[],
  progressCallback: (copiedCount: number) => void = () => {}
): Promise<void> {
  // 动态调整并发数 - 基于文件数量，但限制最大值避免过多并发导致的问题
  const MAX_CONCURRENT_TASKS = Math.min(
    16, // 最大16个并发任务，避免过多导致浏览器崩溃
    Math.max(4, Math.floor(filesToCopy.length / 50))
  );

  // 批处理大小调整
  const BATCH_SIZE = Math.min(
    20, // 最大20个文件一批
    Math.max(5, Math.floor(filesToCopy.length / 20))
  );

  let activeWorkers = 0;
  let copiedCount = 0;
  let failedCount = 0;
  let lastProgressUpdate = Date.now();

  // 记录已创建的目录，避免重复创建
  const createdDirs = new Set<string>();

  // 优先处理小文件和浅层目录的文件
  filesToCopy.sort((a, b) => {
    const aDepth = a.split("/").length;
    const bDepth = b.split("/").length;
    // 先按目录深度排序，再按文件名长度排序（通常短文件名的是配置文件，优先复制）
    return aDepth - bDepth || a.length - b.length;
  });

  // 按批次处理
  const batches: string[][] = [];
  for (let i = 0; i < filesToCopy.length; i += BATCH_SIZE) {
    batches.push(filesToCopy.slice(i, i + BATCH_SIZE));
  }

  // 并行处理批次
  const batchPromises: Promise<void>[] = [];

  for (const batch of batches) {
    // 等待有空闲工作槽位
    while (activeWorkers >= MAX_CONCURRENT_TASKS) {
      await new Promise((resolve) => setTimeout(resolve, 5)); // 增加等待时间，减少CPU使用
    }

    activeWorkers++;

    // 异步处理批次
    const batchPromise = (async (fileBatch) => {
      try {
        const results = await Promise.allSettled(
          fileBatch.map(async (file) => {
            try {
              await enhancedCopyFile(
                sourceRootHandle,
                targetRootHandle,
                file,
                createdDirs
              );
              return { success: true, file };
            } catch (error) {
              console.warn(`复制文件 ${file} 时出错:`, error);
              return { success: false, file, error };
            }
          })
        );

        // 处理结果
        for (const result of results) {
          if (result.status === "fulfilled") {
            if (result.value.success) {
              copiedCount++;
            } else {
              failedCount++;
              // 尝试重新复制，但最多重试一次
              try {
                await enhancedCopyFile(
                  sourceRootHandle,
                  targetRootHandle,
                  result.value.file,
                  createdDirs
                );
                copiedCount++; // 重试成功
                failedCount--;
                console.log(`重试复制文件 ${result.value.file} 成功`);
              } catch (retryError) {
                console.error(
                  `重试复制文件 ${result.value.file} 失败:`,
                  retryError
                );
              }
            }
          } else {
            failedCount++;
          }

          // 降低进度更新频率，提高性能
          const now = Date.now();
          if (now - lastProgressUpdate > 100) {
            // 减少进度更新频率
            progressCallback(copiedCount);
            lastProgressUpdate = now;
          }
        }
      } finally {
        activeWorkers--;
        progressCallback(copiedCount);
      }
    })(batch);

    batchPromises.push(batchPromise);
  }

  // 等待所有批次完成
  await Promise.allSettled(batchPromises);

  // 最终进度更新
  progressCallback(copiedCount);

  // 如果有失败的文件，记录日志
  if (failedCount > 0) {
    console.warn(`复制完成，但有 ${failedCount} 个文件复制失败`);
  }
}

// 递归删除文件
async function deleteFileRecursively(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<void> {
  try {
    const pathParts = filePath.split("/");
    const fileName = pathParts.pop()!;

    let currentHandle = rootHandle;
    for (const part of pathParts) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: false,
        });
      } catch (error) {
        console.warn(`跳过删除文件 ${filePath}，目录不存在:`, error);
        return; // 目录不存在就跳过
      }
    }

    try {
      await currentHandle.removeEntry(fileName);
    } catch (error) {
      console.warn(`无法删除文件 ${filePath}:`, error);
      // 忽略错误，继续执行
    }
  } catch (error) {
    console.warn(`删除文件过程中发生错误 ${filePath}:`, error);
    // 忽略错误，继续执行
  }
}

// 删除版本
export async function deleteVersion(
  rootHandle: FileSystemDirectoryHandle,
  versionFolderName: string
): Promise<void> {
  try {
    // 获取.fe文件夹
    const feHandle = await getOrCreateVersionFolder(rootHandle);

    // 直接使用recursive参数删除整个文件夹，不再逐个删除内部文件
    await feHandle.removeEntry(versionFolderName, { recursive: true });

    console.log(`版本 ${versionFolderName} 已成功删除`);
  } catch (error) {
    console.error(`删除版本时出错:`, error);
    throw error;
  }
}

// 删除空目录
async function deleteEmptyDirectory(
  rootHandle: FileSystemDirectoryHandle,
  dirPath: string
): Promise<void> {
  if (!dirPath) return;

  const pathParts = dirPath.split("/");
  const dirName = pathParts.pop()!;
  let parentHandle = rootHandle;

  // 获取父目录句柄
  for (const part of pathParts) {
    try {
      parentHandle = await parentHandle.getDirectoryHandle(part, {
        create: false,
      });
    } catch (error) {
      console.warn(`删除目录 ${dirPath} 时父目录不存在:`, error);
      return; // 如果父目录不存在，无法删除
    }
  }

  try {
    // 尝试删除目录
    await parentHandle.removeEntry(dirName);
    console.log(`删除目录: ${dirPath}`);
  } catch (error) {
    // 如果目录不为空或有其他错误，记录但不抛出
    console.warn(`删除目录 ${dirPath} 失败:`, error);
    throw new Error(`无法删除目录 ${dirPath}: ${error}`);
  }
}
