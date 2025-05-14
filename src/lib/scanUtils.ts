import { FileSystemEntry, ScanResult, FileDiff, ChangeReport } from "../types";
import ignore from "ignore";
import * as diff from "diff";

// 文本文件扩展名列表
const TEXT_FILE_EXTENSIONS = [
  ".txt",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".json",
  ".md",
  ".gitignore",
  ".svg",
  ".xml",
  ".yml",
  ".yaml",
  ".sh",
  ".bat",
  ".ps1",
  ".py",
  ".rb",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".php",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".scss",
  ".less",
  ".vue",
  ".jsx",
  ".tsx",
  ".config",
  ".lock",
  ".env",
  ".example",
  ".ini",
  ".conf",
  ".toml",
];

// 读取 .gitignore 文件并创建过滤器
export async function createGitignoreFilter(
  rootHandle: FileSystemDirectoryHandle
): Promise<(path: string) => boolean> {
  try {
    // 尝试获取 .gitignore 文件
    const gitignoreHandle = await rootHandle.getFileHandle(".gitignore", {
      create: false,
    });
    const file = await gitignoreHandle.getFile();
    const content = await file.text();

    // 使用 ignore 库解析 .gitignore 规则
    const ig = ignore().add(content);

    // 返回过滤函数
    return (path: string) => !ig.ignores(path);
  } catch (error) {
    // 如果没有 .gitignore 文件或出错，则不过滤任何文件
    console.log("未找到 .gitignore 文件或解析出错，将扫描所有文件");
    return () => true;
  }
}

// 检查文件是否为文本文件
function isTextFile(file: File): boolean {
  if (file.type === "text/plain") return true;

  const extension = file.name
    .substring(file.name.lastIndexOf("."))
    .toLowerCase();
  return TEXT_FILE_EXTENSIONS.includes(extension);
}

// 递归扫描文件夹
export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  shouldInclude: (path: string) => boolean,
  basePath: string = "",
  maxContentSize: number = 1024 * 1024 // 默认限制文本文件内容为1MB
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];

  for await (const [name, handle] of dirHandle.entries()) {
    const path = basePath ? `${basePath}/${name}` : name;

    // 跳过 .fe 版本管理目录
    if (name === ".fe" || path.startsWith(".fe/")) {
      continue;
    }

    // 如果该路径应该被忽略，则跳过
    if (!shouldInclude(path)) {
      continue;
    }

    if (handle.kind === "file") {
      try {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();

        const entry: FileSystemEntry = {
          name,
          kind: "file",
          path,
          lastModified: file.lastModified,
          size: file.size,
        };

        // 对于文本文件，读取内容
        if (file.size < maxContentSize && isTextFile(file)) {
          entry.content = await file.text();
        }

        entries.push(entry);
      } catch (error) {
        console.error(`无法读取文件 ${path}:`, error);
      }
    } else if (handle.kind === "directory") {
      // 对于文件夹，递归扫描
      try {
        const dirHandle = handle as FileSystemDirectoryHandle;
        entries.push({
          name,
          kind: "directory",
          path,
        });

        const subEntries = await scanDirectory(
          dirHandle,
          shouldInclude,
          path,
          maxContentSize
        );
        entries.push(...subEntries);
      } catch (error) {
        console.error(`无法扫描文件夹 ${path}:`, error);
      }
    }
  }

  return entries;
}

// 生成项目树结构字符串
export function generateTreeStructure(entries: FileSystemEntry[]): string {
  // 创建目录结构映射
  const dirMap = new Map<string, Set<string>>();

  // 将每个条目添加到其父目录的集合中
  entries.forEach((entry) => {
    const parts = entry.path.split("/");
    const parentPath = parts.slice(0, -1).join("/");

    if (!dirMap.has(parentPath)) {
      dirMap.set(parentPath, new Set());
    }

    dirMap.get(parentPath)?.add(entry.path);
  });

  // 递归构建树字符串
  function buildTree(path: string = "", prefix: string = ""): string {
    const children = dirMap.get(path) || new Set();
    const sortedChildren = Array.from(children).sort();

    let result = "";

    sortedChildren.forEach((childPath, index) => {
      const isLast = index === sortedChildren.length - 1;
      const entry = entries.find((e) => e.path === childPath);

      if (!entry) return;

      const childName = entry.name;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      result += `${prefix}${connector}${childName}${
        entry.kind === "directory" ? "/" : ""
      }\n`;

      if (entry.kind === "directory") {
        result += buildTree(childPath, prefix + childPrefix);
      }
    });

    return result;
  }

  return buildTree();
}

// 比较两次扫描结果，生成差异报告
export function generateDiffReport(
  oldScan: ScanResult,
  newScan: ScanResult,
  showAllFiles: boolean = false
): ChangeReport {
  const oldEntryMap = new Map(
    oldScan.entries.map((entry) => [entry.path, entry])
  );
  const newEntryMap = new Map(
    newScan.entries.map((entry) => [entry.path, entry])
  );

  const addedFiles: FileSystemEntry[] = [];
  const deletedFiles: FileSystemEntry[] = [];
  const modifiedFiles: FileDiff[] = [];

  // 查找删除的文件
  oldScan.entries.forEach((oldEntry) => {
    if (!newEntryMap.has(oldEntry.path)) {
      deletedFiles.push(oldEntry);
    }
  });

  // 查找新增和修改的文件
  newScan.entries.forEach((newEntry) => {
    const oldEntry = oldEntryMap.get(newEntry.path);

    if (!oldEntry) {
      // 新增的文件
      addedFiles.push(newEntry);

      // 为新增的有内容的文本文件创建差异对象
      if (newEntry.kind === "file" && newEntry.content) {
        const fileDiff: FileDiff = {
          path: newEntry.path,
          type: "added",
          oldContent: "",
          newContent: newEntry.content,
        };

        // 生成差异
        fileDiff.diff = diff.createPatch(
          newEntry.path,
          "",
          newEntry.content,
          "文件不存在",
          "新文件"
        );

        modifiedFiles.push(fileDiff);
      }
    } else if (
      newEntry.kind === "file" &&
      oldEntry.kind === "file" &&
      newEntry.lastModified !== oldEntry.lastModified
    ) {
      // 修改的文件
      const fileDiff: FileDiff = {
        path: newEntry.path,
        type: "modified",
        oldContent: oldEntry.content,
        newContent: newEntry.content,
      };

      // 如果有内容，生成diff
      if (oldEntry.content && newEntry.content) {
        const diffPatch = diff.createPatch(
          newEntry.path,
          oldEntry.content || "",
          newEntry.content || "",
          "",
          ""
        );
        fileDiff.diff = diffPatch;
      }

      modifiedFiles.push(fileDiff);
    }
  });

  // 生成项目结构字符串
  const projectStructure = generateTreeStructure(newScan.entries);

  // 创建变动报告
  const report: ChangeReport = {
    timestamp: newScan.timestamp,
    addedFiles,
    deletedFiles,
    modifiedFiles,
    projectStructure,
  };

  // 如果需要，添加所有文件
  if (showAllFiles) {
    // 只包含文件，不包含目录
    const allFiles = newScan.entries.filter((entry) => entry.kind === "file");
    report.allFiles = allFiles;
  }

  return report;
}

// 生成完整的文本报告
export function generateTextReport(report: ChangeReport): string {
  let result = "# 项目扫描报告\n\n";
  result += `生成时间: ${new Date(report.timestamp).toLocaleString()}\n\n`;

  result += "## 项目结构\n\n";
  result += report.projectStructure + "\n\n";

  if (report.addedFiles.length > 0) {
    result += "## 新增文件\n\n";
    report.addedFiles.forEach((file) => {
      result += `- ${file.path}\n`;
    });
    result += "\n";
  }

  if (report.deletedFiles.length > 0) {
    result += "## 删除文件\n\n";
    report.deletedFiles.forEach((file) => {
      result += `- ${file.path}\n`;
    });
    result += "\n";
  }

  if (report.modifiedFiles.length > 0) {
    result += "## 修改文件\n\n";
    report.modifiedFiles.forEach((file) => {
      result += `### ${file.path}\n\n`;
      if (file.diff) {
        result += "```diff\n" + file.diff + "\n```\n\n";
      } else {
        result += "(无法生成差异信息)\n\n";
      }
    });
  }

  // 添加所有文件内容部分
  if (report.allFiles && report.allFiles.length > 0) {
    result += "## 所有文件内容\n\n";

    report.allFiles.forEach((file) => {
      result += `### ${file.path}\n\n`;
      if (file.content) {
        result += "```\n" + file.content + "\n```\n\n";
      } else {
        result += "(无法显示文件内容)\n\n";
      }
    });
  }

  return result;
}
