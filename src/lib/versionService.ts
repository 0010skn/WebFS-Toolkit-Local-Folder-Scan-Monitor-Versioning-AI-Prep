import { VersionInfo, VersionHistoryItem, FileSystemEntry } from "@/types";
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

// 创建版本备份
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

    // 递归备份文件
    await backupFiles(
      rootHandle,
      versionFolderHandle,
      "",
      shouldInclude,
      progressCallback
    );

    return folderName;
  } catch (error) {
    console.error("创建版本备份时出错:", error);
    throw error;
  }
}

// 递归备份文件
async function backupFiles(
  sourceHandle: FileSystemDirectoryHandle,
  targetHandle: FileSystemDirectoryHandle,
  currentPath: string = "",
  shouldInclude: (path: string) => boolean,
  progressCallback: (progress: number) => void = () => {},
  totalFiles: number = 0,
  processedFiles: number = 0
): Promise<void> {
  // 第一次调用时，计算总文件数
  if (totalFiles === 0) {
    totalFiles = await countFiles(sourceHandle, shouldInclude);
  }

  try {
    for await (const [name, handle] of sourceHandle.entries()) {
      // 跳过 .fe 文件夹
      if (name === ".fe" || name === ".git" || name.startsWith(".git/"))
        continue;

      const path = currentPath ? `${currentPath}/${name}` : name;

      // 检查是否应该包含此文件或文件夹
      if (!shouldInclude(path)) continue;

      if (handle.kind === "file") {
        try {
          // 获取源文件内容
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();

          // 创建目标文件
          const targetFileHandle = await targetHandle.getFileHandle(name, {
            create: true,
          });
          const writable = await targetFileHandle.createWritable();

          // 写入文件内容
          await writable.write(file);
          await writable.close();

          // 更新进度
          processedFiles++;
          const progress = Math.min(
            Math.round((processedFiles / totalFiles) * 100),
            100
          );
          progressCallback(progress);
        } catch (error) {
          console.error(`备份文件 ${path} 时出错:`, error);
        }
      } else if (handle.kind === "directory") {
        try {
          // 创建目标子文件夹
          const subDirHandle = await targetHandle.getDirectoryHandle(name, {
            create: true,
          });

          // 递归备份子文件夹
          await backupFiles(
            handle as FileSystemDirectoryHandle,
            subDirHandle,
            path,
            shouldInclude,
            progressCallback,
            totalFiles,
            processedFiles
          );
        } catch (error) {
          console.error(`备份文件夹 ${path} 时出错:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`处理路径 ${currentPath} 时出错:`, error);
  }
}

// 计算需要备份的文件总数
async function countFiles(
  dirHandle: FileSystemDirectoryHandle,
  shouldInclude: (path: string) => boolean,
  currentPath: string = ""
): Promise<number> {
  let count = 0;

  try {
    for await (const [name, handle] of dirHandle.entries()) {
      // 跳过 .fe 文件夹
      if (name === ".fe" || name === ".git" || name.startsWith(".git/"))
        continue;

      const path = currentPath ? `${currentPath}/${name}` : name;

      // 检查是否应该包含此文件或文件夹
      if (!shouldInclude(path)) continue;

      if (handle.kind === "file") {
        count++;
      } else if (handle.kind === "directory") {
        count += await countFiles(
          handle as FileSystemDirectoryHandle,
          shouldInclude,
          path
        );
      }
    }
  } catch (error) {
    console.error(`计算路径 ${currentPath} 的文件数时出错:`, error);
  }

  return count;
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

// 恢复版本
export async function restoreVersion(
  rootHandle: FileSystemDirectoryHandle,
  versionFolderName: string,
  progressCallback: (progress: number) => void = () => {}
): Promise<void> {
  try {
    // 获取.fe文件夹
    const feHandle = await getOrCreateVersionFolder(rootHandle);

    // 获取版本文件夹
    const versionFolderHandle = await feHandle.getDirectoryHandle(
      versionFolderName,
      { create: false }
    );

    // 获取当前项目文件列表和备份版本文件列表
    const currentProjectFiles = await getProjectFiles(rootHandle);
    const backupVersionFiles = await getVersionFiles(versionFolderHandle);

    // 计算操作总数
    const totalOperations =
      currentProjectFiles.length + backupVersionFiles.length;
    let completedOperations = 0;

    // 1. 删除当前项目中不存在于备份版本中的文件
    for (const filePath of currentProjectFiles) {
      // 跳过 .fe 文件夹及其内容
      if (
        filePath === ".fe" ||
        filePath.startsWith(".fe/") ||
        filePath === ".git" ||
        filePath.startsWith(".git/")
      ) {
        continue;
      }

      // 如果不在备份版本中，则删除
      if (!backupVersionFiles.includes(filePath)) {
        await deleteFileRecursively(rootHandle, filePath);
      }

      // 更新进度
      completedOperations++;
      progressCallback(
        Math.round((completedOperations / totalOperations) * 100)
      );
    }

    // 2. 复制备份版本中的文件到项目目录
    for (const filePath of backupVersionFiles) {
      // 跳过 version_info.json 文件
      if (filePath === "version_info.json") {
        continue;
      }

      await copyFile(versionFolderHandle, rootHandle, filePath);

      // 更新进度
      completedOperations++;
      progressCallback(
        Math.round((completedOperations / totalOperations) * 100)
      );
    }
  } catch (error) {
    console.error("恢复版本时出错:", error);
    throw error;
  }
}

// 获取目录下的所有文件路径
async function getProjectFiles(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = ""
): Promise<string[]> {
  const files: string[] = [];

  for await (const [name, handle] of dirHandle.entries()) {
    const path = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === "file") {
      files.push(path);
    } else if (handle.kind === "directory") {
      files.push(path); // 添加目录本身
      const subFiles = await getProjectFiles(
        handle as FileSystemDirectoryHandle,
        path
      );
      files.push(...subFiles);
    }
  }

  return files;
}

// 获取版本文件夹下的所有文件路径
async function getVersionFiles(
  versionFolderHandle: FileSystemDirectoryHandle,
  basePath: string = ""
): Promise<string[]> {
  const files: string[] = [];

  for await (const [name, handle] of versionFolderHandle.entries()) {
    const path = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === "file") {
      files.push(path);
    } else if (handle.kind === "directory") {
      files.push(path); // 添加目录本身
      const subFiles = await getVersionFiles(
        handle as FileSystemDirectoryHandle,
        path
      );
      files.push(...subFiles);
    }
  }

  return files;
}

// 递归删除文件或文件夹
async function deleteFileRecursively(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<void> {
  const parts = path.split("/");
  const name = parts.pop() || "";

  if (parts.length === 0) {
    // 删除根目录下的文件或文件夹
    await rootHandle.removeEntry(name, { recursive: true });
  } else {
    // 获取父目录，然后删除其中的文件或文件夹
    let parentHandle = rootHandle;

    for (const part of parts) {
      try {
        parentHandle = await parentHandle.getDirectoryHandle(part, {
          create: false,
        });
      } catch (error) {
        console.error(`无法找到目录 ${part}:`, error);
        return;
      }
    }

    await parentHandle.removeEntry(name, { recursive: true });
  }
}

// 复制文件或文件夹
async function copyFile(
  sourceRootHandle: FileSystemDirectoryHandle,
  targetRootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<void> {
  const parts = path.split("/");
  const name = parts.pop() || "";

  // 获取源文件句柄
  let sourceParentHandle = sourceRootHandle;
  for (const part of parts) {
    try {
      sourceParentHandle = await sourceParentHandle.getDirectoryHandle(part, {
        create: false,
      });
    } catch (error) {
      console.error(`无法找到源目录 ${part}:`, error);
      return;
    }
  }

  // 确保目标父目录存在
  let targetParentHandle = targetRootHandle;
  for (const part of parts) {
    targetParentHandle = await targetParentHandle.getDirectoryHandle(part, {
      create: true,
    });
  }

  try {
    // 尝试获取为文件
    const sourceFileHandle = await sourceParentHandle.getFileHandle(name, {
      create: false,
    });
    const file = await sourceFileHandle.getFile();

    // 创建目标文件
    const targetFileHandle = await targetParentHandle.getFileHandle(name, {
      create: true,
    });
    const writable = await targetFileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch (error) {
    // 如果不是文件，尝试作为目录
    try {
      const sourceSubDirHandle = await sourceParentHandle.getDirectoryHandle(
        name,
        { create: false }
      );
      const targetSubDirHandle = await targetParentHandle.getDirectoryHandle(
        name,
        { create: true }
      );

      // 递归复制子目录内容
      for await (const [subName, subHandle] of sourceSubDirHandle.entries()) {
        const subPath = path ? `${path}/${subName}` : subName;
        await copyFile(sourceRootHandle, targetRootHandle, subPath);
      }
    } catch (dirError) {
      console.error(`无法复制路径 ${path}:`, dirError);
    }
  }
}
