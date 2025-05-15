import {
  FileSystemEntry,
  ScanResult,
  FileDiff,
  ChangeReport,
  FunctionInfo,
} from "../types";
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
  maxContentSize: number = 1024 * 1024 * 10 // 默认限制文本文件内容为10MB
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];

  try {
    // 获取目录条目
    const dirEntriesArray: Array<[string, FileSystemHandle]> = [];
    for await (const entry of dirHandle.entries()) {
      dirEntriesArray.push(entry);
    }

    // 处理每个条目
    await Promise.all(
      dirEntriesArray.map(async ([name, handle]) => {
        const path = basePath ? `${basePath}/${name}` : name;

        // 跳过 .fe 版本管理目录
        if (
          name === ".fe" ||
          path.startsWith(".fe/") ||
          name === ".git" ||
          path.startsWith(".git/")
        ) {
          return;
        }

        // 如果该路径应该被忽略，则跳过
        if (!shouldInclude(path)) {
          return;
        }

        try {
          if (handle.kind === "file") {
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
          } else if (handle.kind === "directory") {
            // 对于文件夹，递归扫描
            const dirHandle = handle as FileSystemDirectoryHandle;
            const dirEntry: FileSystemEntry = {
              name,
              kind: "directory",
              path,
            };

            // 先添加目录本身
            entries.push(dirEntry);

            // 然后递归扫描子目录
            try {
              const subEntries = await scanDirectory(
                dirHandle,
                shouldInclude,
                path,
                maxContentSize
              );
              entries.push(...subEntries);
            } catch (subError) {
              console.error(`无法扫描子文件夹 ${path}:`, subError);
            }
          }
        } catch (itemError) {
          console.error(`处理项目 ${path} 时出错:`, itemError);
        }
      })
    );
  } catch (error) {
    console.error(`扫描目录 ${basePath || "根目录"} 时出错:`, error);
  }

  return entries;
}

// 扩展的生成项目树结构字符串，包含函数方法和逻辑节点
export function generateTreeStructure(entries: FileSystemEntry[]): string {
  // 创建目录结构映射
  const dirMap = new Map<string, Set<string>>();
  // 记录文件中的函数和方法
  const fileFunctionsMap = new Map<
    string,
    { name: string; type: string; lines: [number, number] }[]
  >();
  // 记录函数之间的调用关系
  const functionCallsMap = new Map<string, Set<string>>();

  // 将每个条目添加到其父目录的集合中
  entries.forEach((entry) => {
    const parts = entry.path.split("/");
    const parentPath = parts.slice(0, -1).join("/");

    if (!dirMap.has(parentPath)) {
      dirMap.set(parentPath, new Set());
    }

    dirMap.get(parentPath)?.add(entry.path);

    // 提取文件中的函数和方法
    if (entry.kind === "file" && entry.content) {
      extractFunctionsAndMethods(
        entry.path,
        entry.content,
        fileFunctionsMap,
        functionCallsMap
      );
    }
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

      // 如果是文件，并且有提取出的函数/方法，显示这些函数/方法
      if (entry.kind === "file" && fileFunctionsMap.has(childPath)) {
        const functions = fileFunctionsMap.get(childPath) || [];

        functions.forEach((func, funcIndex) => {
          const isLastFunc = funcIndex === functions.length - 1;
          const funcConnector = isLastFunc ? "└── " : "├── ";

          // 显示函数/方法
          result += `${prefix}${childPrefix}${funcConnector}${func.type}: ${func.name} [行${func.lines[0]}-${func.lines[1]}]\n`;

          // 显示函数调用关系
          const callsKey = `${childPath}:${func.name}`;
          if (functionCallsMap.has(callsKey)) {
            const calls = functionCallsMap.get(callsKey) || new Set();
            const callsArray = Array.from(calls);

            callsArray.forEach((calledFunc, callIndex) => {
              const isLastCall = callIndex === callsArray.length - 1;
              const callConnector = isLastCall ? "└──→ " : "├──→ ";
              const callPrefix = isLastCall ? "     " : "│    ";

              result += `${prefix}${childPrefix}${
                isLastFunc ? "    " : "│   "
              }${callConnector}调用: ${calledFunc}\n`;
            });
          }
        });
      }

      if (entry.kind === "directory") {
        result += buildTree(childPath, prefix + childPrefix);
      }
    });

    return result;
  }

  return buildTree();
}

// 从文件内容中提取函数和方法
function extractFunctionsAndMethods(
  filePath: string,
  content: string,
  functionsMap: Map<
    string,
    { name: string; type: string; lines: [number, number] }[]
  >,
  callsMap: Map<string, Set<string>>
): void {
  // 初始化该文件的函数/方法数组
  if (!functionsMap.has(filePath)) {
    functionsMap.set(filePath, []);
  }

  const functions = functionsMap.get(filePath)!;
  const lines = content.split("\n");

  // 检测JavaScript/TypeScript中的函数
  const funcRegex = /(?:export\s+)?(?:async\s+)?(?:function\s+)(\w+)\s*\(/g;
  const methodRegex =
    /(?:public|private|protected|static|async)?\s*(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g;
  const arrowFuncRegex =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
  const classRegex = /(?:export\s+)?class\s+(\w+)/g;

  // 提取函数定义
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 查找函数
    let funcMatch;
    while ((funcMatch = funcRegex.exec(line)) !== null) {
      const funcName = funcMatch[1];
      const startLine = i + 1;
      const endLine = findFunctionEnd(lines, i);
      functions.push({
        name: funcName,
        type: "函数",
        lines: [startLine, endLine],
      });

      // 解析函数体中的调用
      analyzeFunctionCalls(
        filePath,
        funcName,
        lines.slice(i, endLine).join("\n"),
        callsMap
      );

      i = endLine - 1; // 跳过函数体
    }

    // 查找箭头函数
    let arrowMatch;
    while ((arrowMatch = arrowFuncRegex.exec(line)) !== null) {
      const funcName = arrowMatch[1];
      const startLine = i + 1;
      const endLine = findFunctionEnd(lines, i);
      functions.push({
        name: funcName,
        type: "箭头函数",
        lines: [startLine, endLine],
      });

      // 解析函数体中的调用
      analyzeFunctionCalls(
        filePath,
        funcName,
        lines.slice(i, endLine).join("\n"),
        callsMap
      );

      i = endLine - 1; // 跳过函数体
    }

    // 查找类
    let classMatch;
    while ((classMatch = classRegex.exec(line)) !== null) {
      const className = classMatch[1];
      const startLine = i + 1;
      const endLine = findClassEnd(lines, i);
      functions.push({
        name: className,
        type: "类",
        lines: [startLine, endLine],
      });

      // 在类内查找方法
      const classBody = lines.slice(i, endLine).join("\n");
      let methodMatch;
      while ((methodMatch = methodRegex.exec(classBody)) !== null) {
        const methodName = methodMatch[1];
        // 计算方法在文件中的实际行号
        const methodStartLine =
          i + classBody.substring(0, methodMatch.index).split("\n").length;
        const methodEndLine = findMethodEnd(lines, methodStartLine);

        functions.push({
          name: `${className}.${methodName}`,
          type: "方法",
          lines: [methodStartLine, methodEndLine],
        });

        // 解析方法体中的调用
        analyzeFunctionCalls(
          filePath,
          `${className}.${methodName}`,
          lines.slice(methodStartLine, methodEndLine).join("\n"),
          callsMap
        );
      }

      i = endLine - 1; // 跳过类定义
    }
  }
}

// 查找函数结束的行号
function findFunctionEnd(lines: string[], startLine: number): number {
  let braceCount = 0;
  let foundOpeningBrace = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];

    // 计算行中的花括号
    for (let j = 0; j < line.length; j++) {
      if (line[j] === "{") {
        foundOpeningBrace = true;
        braceCount++;
      } else if (line[j] === "}") {
        braceCount--;
      }
    }

    // 如果找到了函数结束位置
    if (foundOpeningBrace && braceCount === 0) {
      return i + 1;
    }

    // 对于箭头函数，可能在没有花括号的情况下结束
    if (
      !foundOpeningBrace &&
      line.includes("=>") &&
      (line.includes(";") || i === lines.length - 1)
    ) {
      return i + 1;
    }
  }

  // 如果没有找到结束位置，返回最后一行
  return lines.length;
}

// 查找类结束的行号
function findClassEnd(lines: string[], startLine: number): number {
  return findFunctionEnd(lines, startLine); // 类和函数的结束逻辑相同
}

// 查找方法结束的行号
function findMethodEnd(lines: string[], startLine: number): number {
  return findFunctionEnd(lines, startLine); // 方法和函数的结束逻辑相同
}

// 分析函数调用关系
function analyzeFunctionCalls(
  filePath: string,
  funcName: string,
  functionBody: string,
  callsMap: Map<string, Set<string>>
): void {
  // 创建该函数的调用集合的键
  const key = `${filePath}:${funcName}`;

  if (!callsMap.has(key)) {
    callsMap.set(key, new Set());
  }

  const calls = callsMap.get(key)!;

  // 简单的函数调用检测，实际项目中可能需要更复杂的分析
  const callRegex = /(?<!\w)(\w+)\s*\(/g;
  let match;

  while ((match = callRegex.exec(functionBody)) !== null) {
    const calledFunc = match[1];
    // 避免将自己加入调用列表
    if (
      calledFunc !== funcName &&
      !calledFunc.match(/^(if|for|while|switch|catch)$/)
    ) {
      calls.add(calledFunc);
    }
  }
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

  // 分类用于显示的目录集合
  const addedDirs: Set<string> = new Set();
  const deletedDirs: Set<string> = new Set();

  // 查找删除的文件和文件夹
  oldScan.entries.forEach((oldEntry) => {
    if (!newEntryMap.has(oldEntry.path)) {
      deletedFiles.push(oldEntry);

      // 如果是文件夹，记录到删除的文件夹集合中
      if (oldEntry.kind === "directory") {
        deletedDirs.add(oldEntry.path);
      }
    }
  });

  // 查找新增和修改的文件和文件夹
  newScan.entries.forEach((newEntry) => {
    const oldEntry = oldEntryMap.get(newEntry.path);

    if (!oldEntry) {
      // 新增的文件或文件夹
      addedFiles.push(newEntry);

      // 如果是文件夹，记录到新增的文件夹集合中
      if (newEntry.kind === "directory") {
        addedDirs.add(newEntry.path);
      }

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
    // 注意：文件夹内容的修改已经通过文件的增删改表现出来，所以这里不需要特别处理文件夹的修改
  });

  // 过滤掉已被删除的父文件夹内的文件，避免重复显示
  const filteredDeletedFiles = deletedFiles.filter((entry) => {
    // 如果是文件，检查其父目录是否已被删除
    if (entry.kind === "file") {
      const pathParts = entry.path.split("/");
      // 依次检查从根到当前路径的每一级父目录
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join("/");
        if (deletedDirs.has(parentPath)) {
          // 如果父目录已被删除，则该文件不需要单独显示
          return false;
        }
      }
    }
    return true;
  });

  // 过滤掉已添加的父文件夹内的文件，避免重复显示
  const filteredAddedFiles = addedFiles.filter((entry) => {
    // 如果是文件，检查其父目录是否已被添加
    if (entry.kind === "file") {
      const pathParts = entry.path.split("/");
      // 依次检查从根到当前路径的每一级父目录
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join("/");
        if (addedDirs.has(parentPath)) {
          // 如果父目录已被添加，则该文件不需要单独显示
          return false;
        }
      }
    }
    return true;
  });

  // 生成项目结构字符串
  const projectStructure = generateTreeStructure(newScan.entries);

  // 收集代码结构信息
  const codeStructure = collectCodeStructureInfo(newScan.entries);

  // 创建变动报告
  const report: ChangeReport = {
    timestamp: newScan.timestamp,
    addedFiles: filteredAddedFiles,
    deletedFiles: filteredDeletedFiles,
    modifiedFiles,
    projectStructure,
    codeStructure,
  };

  // 如果需要，添加所有文件
  if (showAllFiles) {
    // 包含文件和目录
    report.allFiles = newScan.entries;
  }

  return report;
}

// 收集代码结构信息
function collectCodeStructureInfo(
  entries: FileSystemEntry[]
): ChangeReport["codeStructure"] {
  // 函数和方法信息数组
  const functions: FunctionInfo[] = [];

  // 创建文件中的函数和方法映射
  const fileFunctionsMap = new Map<
    string,
    { name: string; type: string; lines: [number, number] }[]
  >();

  // 函数调用关系映射
  const functionCallsMap = new Map<string, Set<string>>();

  // 处理每个文件条目，提取函数和方法信息
  entries.forEach((entry) => {
    if (entry.kind === "file" && entry.content) {
      extractFunctionsAndMethods(
        entry.path,
        entry.content,
        fileFunctionsMap,
        functionCallsMap
      );
    }
  });

  // 将提取的函数信息转换为FunctionInfo数组
  fileFunctionsMap.forEach((fileFunctions, filePath) => {
    fileFunctions.forEach((func) => {
      const callsKey = `${filePath}:${func.name}`;
      const calls = functionCallsMap.get(callsKey) || new Set();

      functions.push({
        name: func.name,
        type: func.type as "函数" | "方法" | "类" | "箭头函数",
        lines: func.lines,
        filePath,
        calls: Array.from(calls),
      });
    });
  });

  // 统计代码信息
  const stats = {
    totalFiles: entries.filter((entry) => entry.kind === "file").length,
    totalFunctions: 0,
    totalMethods: 0,
    totalClasses: 0,
    totalLines: 0,
  };

  // 计算总行数
  entries.forEach((entry) => {
    if (entry.kind === "file" && entry.content) {
      stats.totalLines += entry.content.split("\n").length;
    }
  });

  // 统计函数、方法和类数量
  functions.forEach((func) => {
    switch (func.type) {
      case "函数":
      case "箭头函数":
        stats.totalFunctions++;
        break;
      case "方法":
        stats.totalMethods++;
        break;
      case "类":
        stats.totalClasses++;
        break;
    }
  });

  return {
    functions,
    ...stats,
  };
}

// 生成完整的文本报告
export function generateTextReport(report: ChangeReport): string {
  let result = "# 项目扫描报告\n\n";
  result += `生成时间: ${new Date(report.timestamp).toLocaleString()}\n\n`;

  result += "## 项目结构\n\n";
  result += "此结构包含文件、文件夹、函数、方法以及它们之间的调用关系：\n\n";
  result += report.projectStructure + "\n\n";

  // 添加代码结构统计
  if (report.codeStructure) {
    result += "## 代码结构统计\n\n";
    const stats = report.codeStructure;
    result += `- 总文件数: ${stats.totalFiles}\n`;
    result += `- 总函数数: ${stats.totalFunctions}\n`;
    result += `- 总方法数: ${stats.totalMethods}\n`;
    result += `- 总类数: ${stats.totalClasses}\n`;
    result += `- 总代码行数: ${stats.totalLines}\n\n`;

    // 添加函数调用关系图表示
    if (stats.functions.length > 0) {
      result += "## 函数和方法调用关系\n\n";

      // 按文件分组显示函数
      const fileGroups = new Map<string, FunctionInfo[]>();
      stats.functions.forEach((func) => {
        if (!fileGroups.has(func.filePath)) {
          fileGroups.set(func.filePath, []);
        }
        fileGroups.get(func.filePath)!.push(func);
      });

      fileGroups.forEach((functions, filePath) => {
        result += `### 文件: ${filePath}\n\n`;

        functions.forEach((func) => {
          result += `- ${func.type}: ${func.name} [行 ${func.lines[0]}-${func.lines[1]}]`;

          if (func.calls.length > 0) {
            result += `\n  调用:\n`;
            func.calls.forEach((call) => {
              result += `  - ${call}\n`;
            });
          } else {
            result += " (无调用)\n";
          }
        });

        result += "\n";
      });
    }
  }

  if (report.addedFiles.length > 0) {
    result += "## 新增文件和文件夹\n\n";
    report.addedFiles.forEach((file) => {
      const isDirectory = file.kind === "directory";
      result += `- ${file.path}${isDirectory ? "/" : ""} ${
        isDirectory ? "[目录]" : ""
      }\n`;
    });
    result += "\n";
  }

  if (report.deletedFiles.length > 0) {
    result += "## 删除文件和文件夹\n\n";
    report.deletedFiles.forEach((file) => {
      const isDirectory = file.kind === "directory";
      result += `- ${file.path}${isDirectory ? "/" : ""} ${
        isDirectory ? "[目录]" : ""
      }\n`;
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
    result += "## 所有文件和文件夹内容\n\n";

    // 先统计文件和文件夹的数量
    const fileCount = report.allFiles.filter(
      (file) => file.kind === "file"
    ).length;
    const dirCount = report.allFiles.filter(
      (file) => file.kind === "directory"
    ).length;

    result += `共计: ${report.allFiles.length} 个项目 (${fileCount} 个文件, ${dirCount} 个文件夹)\n\n`;

    report.allFiles.forEach((file) => {
      const isDirectory = file.kind === "directory";
      result += `### ${file.path}${isDirectory ? "/" : ""} ${
        isDirectory ? "[目录]" : ""
      }\n\n`;

      if (!isDirectory && file.content) {
        result += "```\n" + file.content + "\n```\n\n";
      } else if (isDirectory) {
        result += "(文件夹)\n\n";
      } else {
        result += "(无法显示文件内容)\n\n";
      }
    });
  }

  return result;
}
