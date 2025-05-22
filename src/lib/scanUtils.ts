import {
  FileSystemEntry,
  ScanResult,
  FileDiff,
  ChangeReport,
  FunctionInfo,
  ModuleInfo,
  VariableInfo,
  CommentInfo,
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
  // 添加更多编程语言支持
  ".dart", // Dart
  ".lua", // Lua
  ".r", // R
  ".scala", // Scala
  ".groovy", // Groovy
  ".pl", // Perl
  ".sql", // SQL
  ".m", // Objective-C/Swift
  ".mm", // Objective-C++
  ".f", // Fortran
  ".f90", // Fortran
  ".hs", // Haskell
  ".ex", // Elixir
  ".exs", // Elixir
  ".erl", // Erlang
  ".clj", // Clojure
  ".elm", // Elm
  ".coffee", // CoffeeScript
  ".hbs", // Handlebars
  ".pug", // Pug
  ".sass", // Sass
  ".nim", // Nim
  ".purs", // PureScript
  ".hack", // Hack
  ".fs", // F#
  ".fsi", // F#
  ".fsx", // F#
  ".rkt", // Racket
  ".sol", // Solidity
  ".zig", // Zig
  ".jl", // Julia
  ".d", // D
  ".v", // V/Verilog
  ".svelte", // Svelte
  ".astro", // Astro
  ".ipynb", // Jupyter Notebook
  ".tf", // Terraform
  ".hcl", // HCL
  ".proto", // Protocol Buffers
  ".graphql", // GraphQL
  ".gql", // GraphQL
  ".prisma", // Prisma
  ".tsx", // React TypeScript
  ".jsx", // React JavaScript
  ".mdx", // MDX
  ".razor", // Razor
  ".cshtml", // Razor
  ".vbhtml", // Razor
  ".gradle", // Gradle
  ".csproj", // C# Project
  ".vbproj", // Visual Basic Project
  ".fsproj", // F# Project
  ".vcxproj", // Visual C++ Project
  ".user", // User settings
  ".editorconfig", // Editor config
];

// 进度更新回调类型
type ProgressCallback = (progress: number) => void;

// 进度更新函数
export function updateScanProgress(
  current: number,
  total: number,
  callback: ProgressCallback
): void {
  // 确保进度值在0-100之间
  const progress = Math.min(
    Math.max(Math.round((current / total) * 100), 0),
    100
  );
  callback(progress);
}

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

    // 创建一个缓存来存储已经检查过的路径结果
    const cache = new Map<string, boolean>();

    // 返回带缓存的过滤函数
    return (path: string) => {
      if (cache.has(path)) {
        return cache.get(path)!;
      }

      const result = !ig.ignores(path);
      cache.set(path, result);
      return result;
    };
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

// 递归扫描文件夹 - 优化版本
export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  shouldInclude: (path: string) => boolean,
  basePath: string = "",
  maxContentSize: number = 1024 * 1024 * 1, // 减小默认限制为1MB以提高性能
  progressCallback?: ProgressCallback // 添加进度回调参数
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  const BATCH_SIZE = 100; // 批处理大小
  const MAX_CONCURRENT_DIRS = 32; // 最大并行处理目录数

  // 创建一个工作队列来控制并发
  const dirQueue: { handle: FileSystemDirectoryHandle; path: string }[] = [];
  let activeWorkers = 0;

  // 用于进度计算的变量
  let totalItems = 1; // 初始值为1，表示根目录
  let processedItems = 0;
  let lastProgressUpdate = 0;

  // 首先计算大致的项目总数，以便更准确地报告进度
  if (progressCallback) {
    try {
      let estimatedCount = 0;
      // 快速计算项目数量的函数 - 提到外面以避免严格模式错误
      const countItems = async (
        handle: FileSystemDirectoryHandle,
        path: string = ""
      ): Promise<number> => {
        let count = 1; // 目录本身算一个
        try {
          for await (const [name, entry] of handle.entries()) {
            const entryPath = path ? `${path}/${name}` : name;

            // 跳过 .fe 和 .git 目录
            if (
              name === ".fe" ||
              path.startsWith(".fe/") ||
              name === ".git" ||
              path.startsWith(".git/")
            ) {
              continue;
            }

            // 应用 gitignore 过滤
            if (!shouldInclude(entryPath)) {
              continue;
            }

            if (entry.kind === "directory") {
              // 对于目录，递归计数但限制深度
              count += await countItems(
                entry as FileSystemDirectoryHandle,
                entryPath
              );
            } else {
              count += 1;
            }
          }
        } catch (error) {
          console.error(`计算 ${path || "根目录"} 中的项目数量时出错:`, error);
        }
        return count;
      };

      // 限制计数时间，最多花费500ms进行估算
      const timeoutPromise = new Promise<number>((resolve) => {
        setTimeout(() => resolve(100), 500); // 如果超时，返回一个默认估计值
      });

      // 与实际计数竞争
      estimatedCount = await Promise.race([
        countItems(dirHandle),
        timeoutPromise,
      ]);

      totalItems = Math.max(estimatedCount, 100); // 确保至少有100个项目，避免过早达到100%
      console.log(`估计项目总数: ${totalItems}`);

      // 初始进度为0
      progressCallback(0);
    } catch (error) {
      console.error("计算项目总数时出错:", error);
      totalItems = 1000; // 使用默认值
    }
  }

  // 处理单个目录的函数
  async function processDirectory(
    dirHandle: FileSystemDirectoryHandle,
    basePath: string
  ): Promise<FileSystemEntry[]> {
    const localEntries: FileSystemEntry[] = [];

    try {
      // 获取目录条目
      const dirEntriesArray: Array<[string, FileSystemHandle]> = [];
      for await (const entry of dirHandle.entries()) {
        dirEntriesArray.push(entry);
      }

      // 添加目录本身（如果不是根目录）
      if (basePath) {
        const dirEntry: FileSystemEntry = {
          name: dirHandle.name,
          path: basePath,
          type: "directory",
        };
        localEntries.push(dirEntry);

        // 更新进度
        processedItems++;
        if (
          progressCallback &&
          (processedItems % 10 === 0 || Date.now() - lastProgressUpdate > 100)
        ) {
          updateScanProgress(processedItems, totalItems, progressCallback);
          lastProgressUpdate = Date.now();
        }
      }

      // 分批处理文件，每批BATCH_SIZE个
      const batches: Array<Array<[string, FileSystemHandle]>> = [];
      for (let i = 0; i < dirEntriesArray.length; i += BATCH_SIZE) {
        batches.push(dirEntriesArray.slice(i, i + BATCH_SIZE));
      }

      // 按批次处理文件
      for (const batch of batches) {
        await Promise.all(
          batch.map(async ([name, handle]) => {
            const path = basePath ? `${basePath}/${name}` : name;

            // 跳过 .fe 版本管理目录和 .git 目录
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

                // 创建基本文件条目，不包含内容
                const entry: FileSystemEntry = {
                  name,
                  path,
                  lastModified: file.lastModified,
                  size: file.size,
                  type: "file",
                };

                // 只读取小型文本文件的内容，提高性能
                if (
                  file.size < maxContentSize &&
                  isTextFile(file) &&
                  file.size < 1 * 1024 * 1024
                ) {
                  // 只读取小于1MB的文本文件
                  try {
                    entry.content = await file.text();
                  } catch (contentError) {
                    console.log(`无法读取文件内容 ${path}: ${contentError}`);
                  }
                }
                localEntries.push(entry);

                // 更新进度
                processedItems++;
                if (
                  progressCallback &&
                  (processedItems % 10 === 0 ||
                    Date.now() - lastProgressUpdate > 100)
                ) {
                  updateScanProgress(
                    processedItems,
                    totalItems,
                    progressCallback
                  );
                  lastProgressUpdate = Date.now();
                }
              } else if (handle.kind === "directory") {
                // 将子目录添加到队列中，而不是立即处理
                dirQueue.push({
                  handle: handle as FileSystemDirectoryHandle,
                  path,
                });
              }
            } catch (itemError) {
              console.error(`处理项目 ${path} 时出错:`, itemError);
              // 即使出错也计入处理项
              processedItems++;
            }
          })
        );
      }
    } catch (error) {
      console.error(`扫描目录 ${basePath || "根目录"} 时出错:`, error);
    }

    return localEntries;
  }

  // 使用工作队列处理目录
  async function processQueue(): Promise<void> {
    // 初始处理根目录
    const rootEntries = await processDirectory(dirHandle, basePath);
    entries.push(...rootEntries);

    // 处理队列中的目录
    while (dirQueue.length > 0 || activeWorkers > 0) {
      // 如果有空闲工作槽位且队列中有目录，则处理下一个目录
      while (activeWorkers < MAX_CONCURRENT_DIRS && dirQueue.length > 0) {
        const nextDir = dirQueue.shift()!;
        activeWorkers++;

        // 异步处理目录
        processDirectory(nextDir.handle, nextDir.path)
          .then((dirEntries) => {
            entries.push(...dirEntries);
            activeWorkers--;
          })
          .catch((error) => {
            console.error(`处理目录 ${nextDir.path} 时出错:`, error);
            activeWorkers--;
          });
      }

      // 等待一小段时间，让其他任务有机会执行
      if (dirQueue.length > 0 || activeWorkers > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // 扫描完成，进度设为100%
    if (progressCallback) {
      progressCallback(100);
    }
  }

  // 开始处理队列
  await processQueue();

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
    if (entry.type === "file" && entry.content) {
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
        entry.type === "directory" ? "/" : ""
      }\n`;

      // 如果是文件，并且有提取出的函数/方法，显示这些函数/方法
      if (entry.type === "file" && fileFunctionsMap.has(childPath)) {
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

      if (entry.type === "directory") {
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
  const fileExtension = filePath
    .substring(filePath.lastIndexOf("."))
    .toLowerCase();

  // 根据文件类型选择合适的正则表达式
  let funcRegex, methodRegex, arrowFuncRegex, classRegex, constructorRegex;

  // JavaScript/TypeScript/React
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(fileExtension)) {
    // 函数定义正则表达式（包括导出、异步等变体）
    funcRegex = /(?:export\s+)?(?:async\s+)?(?:function\s+)(\w+)\s*\(/g;
    // 方法定义正则表达式（包括访问修饰符、静态、异步等变体）
    methodRegex =
      /(?:public|private|protected|static|async)?\s*(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g;
    // 箭头函数正则表达式
    arrowFuncRegex =
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    // 类定义正则表达式
    classRegex = /(?:export\s+)?class\s+(\w+)/g;
    // 构造函数正则表达式
    constructorRegex = /constructor\s*\(/g;
  }
  // Python
  else if ([".py"].includes(fileExtension)) {
    // Python函数定义
    funcRegex = /def\s+(\w+)\s*\(/g;
    // Python类定义
    classRegex = /class\s+(\w+)(?:\(.*\))?:/g;
    // Python中没有箭头函数和典型的方法语法，但方法在类内定义
    methodRegex = null;
    arrowFuncRegex = null;
    constructorRegex = /def\s+__init__\s*\(/g;
  }
  // Java, Kotlin
  else if ([".java", ".kt"].includes(fileExtension)) {
    funcRegex =
      /(?:public|private|protected|static)?\s+(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+(?:,\s*\w+)*)?\s*{/g;
    methodRegex =
      /(?:@\w+(?:\([^)]*\))?\s*)*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+(?:,\s*\w+)*)?\s*{/g;
    classRegex =
      /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+\w+(?:<[^>]+>)?)?(?:\s+implements\s+\w+(?:<[^>]+>)?(?:,\s*\w+(?:<[^>]+>)?)*)?/g;
    arrowFuncRegex = null;
    constructorRegex = /(?:public|private|protected)?\s+(\w+)\s*\([^)]*\)\s*{/g; // 构造函数名与类名相同
  }
  // C/C++
  else if ([".c", ".cpp", ".cc", ".h", ".hpp"].includes(fileExtension)) {
    funcRegex =
      /(?:static\s+)?(?:inline\s+)?(?:constexpr\s+)?(?:\w+(?:::\w+)*(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:const|noexcept|override|final)?\s*{/g;
    methodRegex =
      /(?:virtual\s+)?(?:static\s+)?(?:inline\s+)?(?:constexpr\s+)?(?:\w+(?:::\w+)*(?:<[^>]+>)?)\s+(\w+)::\w+\s*\([^)]*\)\s*(?:const|noexcept|override|final)?\s*{/g;
    classRegex =
      /(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|protected|private)\s+\w+(?:::\w+)*(?:<[^>]+>)?(?:\s*,\s*(?:public|protected|private)\s+\w+(?:::\w+)*(?:<[^>]+>)?)*)?/g;
    arrowFuncRegex = null;
    constructorRegex =
      /(\w+)::\1\s*\([^)]*\)\s*(?::\s*\w+\([^)]*\)(?:\s*,\s*\w+\([^)]*\))*)?\s*{/g;
  }
  // C#
  else if ([".cs"].includes(fileExtension)) {
    funcRegex =
      /(?:public|private|protected|internal|static|async)?\s+(?:override\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:where\s+\w+\s*:\s*\w+(?:,\s*\w+)*)?\s*{/g;
    methodRegex =
      /(?:public|private|protected|internal)?\s+(?:virtual\s+)?(?:static\s+)?(?:async\s+)?(?:override\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:where\s+\w+\s*:\s*\w+(?:,\s*\w+)*)?\s*{/g;
    classRegex =
      /(?:public|private|protected|internal)?\s*(?:static\s+)?(?:partial\s+)?(?:sealed\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*\w+(?:<[^>]+>)?(?:\s*,\s*\w+(?:<[^>]+>)?)*)?/g;
    arrowFuncRegex =
      /(?:public|private|protected|internal)?\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*=>\s*[^;]+;/g;
    constructorRegex =
      /(?:public|private|protected|internal)?\s+(\w+)\s*\([^)]*\)\s*(?::\s*base\([^)]*\))?\s*{/g;
  }
  // Go
  else if ([".go"].includes(fileExtension)) {
    funcRegex = /func\s+(\w+)\s*\([^)]*\)\s*(?:\([^)]*\)|[^{]*)\s*{/g;
    methodRegex =
      /func\s*\(\s*\w+\s+\*?\w+\s*\)\s*(\w+)\s*\([^)]*\)\s*(?:\([^)]*\)|[^{]*)\s*{/g;
    classRegex = /type\s+(\w+)\s+struct\s*{/g;
    arrowFuncRegex = null;
    constructorRegex = null;
  }
  // Swift
  else if ([".swift"].includes(fileExtension)) {
    funcRegex = /func\s+(\w+)\s*\([^)]*\)(?:\s*->\s*(?:\w+|[^{]*))?/g;
    methodRegex = /func\s+(\w+)\s*\([^)]*\)(?:\s*->\s*(?:\w+|[^{]*))?/g;
    classRegex =
      /(?:public\s+|private\s+|internal\s+|open\s+|fileprivate\s+)?class\s+(\w+)(?:\s*:\s*\w+(?:\s*,\s*\w+)*)?/g;
    arrowFuncRegex = /(?:let|var)\s+(\w+)\s*=\s*{(?:[^}]*)\s*->\s*(?:[^}]*)}/g;
    constructorRegex = /init\s*\([^)]*\)/g;
  }
  // Rust
  else if ([".rs"].includes(fileExtension)) {
    funcRegex = /fn\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)(?:\s*->\s*[^{]*)?/g;
    methodRegex =
      /impl(?:<[^>]+>)?\s+(?:[^{]+)\s*{[\s\S]*?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)(?:\s*->\s*[^{]*)?/g;
    classRegex =
      /struct\s+(\w+)(?:<[^>]+>)?|enum\s+(\w+)(?:<[^>]+>)?|trait\s+(\w+)(?:<[^>]+>)?/g;
    arrowFuncRegex = null;
    constructorRegex = /fn\s+new\s*\([^)]*\)(?:\s*->\s*[^{]*)?/g;
  }
  // PHP
  else if ([".php"].includes(fileExtension)) {
    funcRegex = /function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\??\w+)?/g;
    methodRegex =
      /(?:public|private|protected|static)?\s+function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\??\w+)?/g;
    classRegex =
      /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+\w+(?:\s*,\s*\w+)*)?/g;
    arrowFuncRegex =
      /(?:public|private|protected|static)?\s+\$(\w+)\s*=\s*(?:static\s+)?function\s*\([^)]*\)\s*(?:use\s*\([^)]*\))?\s*{/g;
    constructorRegex = /function\s+__construct\s*\([^)]*\)/g;
  }
  // 默认情况下使用宽松的正则表达式，适用于大多数编程语言
  else {
    funcRegex = /(?:function|func|def|fn|sub|procedure)\s+(\w+)\s*\(/g;
    methodRegex =
      /(?:\w+\.)?\s*(\w+)\s*\([^)]*\)\s*(?:->|:|=>)?\s*(?:{|\(|begin)/g;
    classRegex = /(?:class|interface|trait|struct|record|type)\s+(\w+)/g;
    arrowFuncRegex =
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?:=>|->)/g;
    constructorRegex = /(?:constructor|init|new|create|__init__|__new__)\s*\(/g;
  }

  // 提取函数定义
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 查找函数
    if (funcRegex) {
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
    }

    // 查找箭头函数
    if (arrowFuncRegex) {
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
    }

    // 查找类
    if (classRegex) {
      let classMatch;
      while ((classMatch = classRegex.exec(line)) !== null) {
        const className = classMatch[1] || classMatch[2] || classMatch[3]; // 支持多种捕获组模式
        if (!className) continue;

        const startLine = i + 1;
        const endLine = findClassEnd(lines, i);
        functions.push({
          name: className,
          type: "类",
          lines: [startLine, endLine],
        });

        // 在类内查找方法
        const classBody = lines.slice(i, endLine).join("\n");

        // 构造函数
        if (constructorRegex) {
          let constructorMatch;
          const constructorRegexCopy = new RegExp(
            constructorRegex.source,
            constructorRegex.flags
          );
          while (
            (constructorMatch = constructorRegexCopy.exec(classBody)) !== null
          ) {
            // 计算构造函数在文件中的实际行号
            const ctorStartLine =
              i +
              classBody.substring(0, constructorMatch.index).split("\n").length;
            const ctorEndLine = findMethodEnd(lines, ctorStartLine);

            functions.push({
              name: `${className}.constructor`,
              type: "方法",
              lines: [ctorStartLine, ctorEndLine],
            });

            // 解析构造函数体中的调用
            analyzeFunctionCalls(
              filePath,
              `${className}.constructor`,
              lines.slice(ctorStartLine, ctorEndLine).join("\n"),
              callsMap
            );
          }
        }

        // 其他方法
        if (methodRegex) {
          let methodMatch;
          const methodRegexCopy = new RegExp(
            methodRegex.source,
            methodRegex.flags
          );
          while ((methodMatch = methodRegexCopy.exec(classBody)) !== null) {
            const methodName = methodMatch[1];
            if (!methodName) continue;

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
        }

        i = endLine - 1; // 跳过类定义
      }
    }

    // 查找独立的方法（不在类内部）
    if (
      methodRegex &&
      !line.trim().startsWith("//") &&
      !line.trim().startsWith("/*")
    ) {
      let methodMatch;
      while ((methodMatch = methodRegex.exec(line)) !== null) {
        // 检查这是否是一个独立方法而不是类内方法（已在上面处理）
        const methodName = methodMatch[1];
        const context = lines.slice(Math.max(0, i - 5), i).join("\n");

        // 如果前面没有类定义，则认为是独立方法
        if (
          !context.includes("class ") &&
          !context.includes("interface ") &&
          !context.includes("struct ") &&
          !context.includes("trait ")
        ) {
          const startLine = i + 1;
          const endLine = findMethodEnd(lines, i);

          functions.push({
            name: methodName,
            type: "函数", // 独立方法作为函数处理
            lines: [startLine, endLine],
          });

          // 解析方法体中的调用
          analyzeFunctionCalls(
            filePath,
            methodName,
            lines.slice(i, endLine).join("\n"),
            callsMap
          );

          i = endLine - 1; // 跳过方法体
        }
      }
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
  const fileExtension = filePath
    .substring(filePath.lastIndexOf("."))
    .toLowerCase();

  // 移除注释，使解析更准确
  const bodyWithoutComments = functionBody
    .replace(/\/\/.*$/gm, "") // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, ""); // 移除多行注释

  // 根据文件类型使用不同的调用检测规则
  let callRegex;

  // JavaScript/TypeScript等使用的函数调用模式
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(fileExtension)) {
    callRegex = /(?<!\w|\.|\$)(\w+)\s*\(/g;

    // 还要检测对象方法调用
    const methodCallRegex = /(\w+)\.(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodCallRegex.exec(bodyWithoutComments)) !== null) {
      const objectName = methodMatch[1];
      const methodName = methodMatch[2];

      // 避免将自己加入调用列表，排除常见关键字和内置方法
      if (
        `${objectName}.${methodName}` !== funcName &&
        ![
          "if",
          "for",
          "while",
          "switch",
          "catch",
          "console.log",
          "parseInt",
          "parseFloat",
        ].includes(methodName)
      ) {
        calls.add(`${objectName}.${methodName}`);
      }
    }
  }
  // Python
  else if ([".py"].includes(fileExtension)) {
    callRegex = /(?<!\w|\.)(\w+)\s*\(/g;

    // 检测方法调用
    const methodCallRegex = /(\w+)\.(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodCallRegex.exec(bodyWithoutComments)) !== null) {
      const objectName = methodMatch[1];
      const methodName = methodMatch[2];

      // 排除常见内置方法
      if (
        ![
          "print",
          "len",
          "str",
          "int",
          "float",
          "list",
          "dict",
          "set",
          "tuple",
        ].includes(methodName)
      ) {
        calls.add(`${objectName}.${methodName}`);
      }
    }

    // 还要检测装饰器
    const decoratorRegex = /@(\w+)/g;
    let decoratorMatch;
    while (
      (decoratorMatch = decoratorRegex.exec(bodyWithoutComments)) !== null
    ) {
      const decoratorName = decoratorMatch[1];
      calls.add(decoratorName);
    }
  }
  // Java/Kotlin
  else if ([".java", ".kt"].includes(fileExtension)) {
    callRegex = /(?<!\w|\.)(\w+)\s*\(/g;

    // 处理方法调用
    const methodCallRegex = /(?:(\w+)\.)?(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodCallRegex.exec(bodyWithoutComments)) !== null) {
      const objectName = methodMatch[1];
      const methodName = methodMatch[2];

      if (objectName) {
        calls.add(`${objectName}.${methodName}`);
      } else if (
        methodName !== funcName &&
        !["if", "for", "while", "switch", "catch", "super", "this"].includes(
          methodName
        )
      ) {
        calls.add(methodName);
      }
    }
  }
  // C/C++/C#
  else if ([".c", ".cpp", ".cc", ".h", ".hpp", ".cs"].includes(fileExtension)) {
    callRegex = /(?<!\w|::|\.|\->)(\w+)\s*\(/g;

    // 处理方法调用，包括:: ->操作符
    const methodCallRegex = /(?:(\w+)(?:::|\.|->))?(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodCallRegex.exec(bodyWithoutComments)) !== null) {
      const objectName = methodMatch[1];
      const methodName = methodMatch[2];

      if (objectName) {
        calls.add(`${objectName}.${methodName}`);
      } else if (
        methodName !== funcName &&
        ![
          "if",
          "for",
          "while",
          "switch",
          "catch",
          "sizeof",
          "malloc",
          "free",
        ].includes(methodName)
      ) {
        calls.add(methodName);
      }
    }
  }
  // Go
  else if ([".go"].includes(fileExtension)) {
    callRegex = /(?<!\w|\.)(\w+)\s*\(/g;

    const methodCallRegex = /(?:(\w+)\.)?(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodCallRegex.exec(bodyWithoutComments)) !== null) {
      const objectName = methodMatch[1];
      const methodName = methodMatch[2];

      if (objectName) {
        calls.add(`${objectName}.${methodName}`);
      } else if (
        methodName !== funcName &&
        ![
          "if",
          "for",
          "switch",
          "select",
          "defer",
          "go",
          "make",
          "len",
          "cap",
        ].includes(methodName)
      ) {
        calls.add(methodName);
      }
    }
  }
  // 默认情况使用通用的函数调用检测
  else {
    callRegex = /(?<!\w|\.)(\w+)\s*\(/g;
  }

  // 处理一般函数调用
  if (callRegex) {
    let match;
    while ((match = callRegex.exec(bodyWithoutComments)) !== null) {
      const calledFunc = match[1];
      // 避免将自己加入调用列表和常见的控制结构关键字
      if (
        calledFunc !== funcName &&
        !calledFunc.match(
          /^(if|for|while|switch|catch|return|throw|try|finally)$/
        )
      ) {
        calls.add(calledFunc);
      }
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
      if (oldEntry.type === "directory") {
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
      if (newEntry.type === "directory") {
        addedDirs.add(newEntry.path);
      }

      // 为新增的有内容的文本文件创建差异对象
      if (newEntry.type === "file" && newEntry.content) {
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
      newEntry.type === "file" &&
      oldEntry.type === "file" &&
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
    if (entry.type === "file") {
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
    if (entry.type === "file") {
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
    fileChanges: [],
    dirChanges: [],
    gitignoreRules: [],
  };

  // 如果需要，添加所有文件
  if (showAllFiles) {
    // 包含文件和目录
    report.allFiles = newScan.entries;
  }

  return report;
}

// 收集代码结构信息
export function collectCodeStructureInfo(
  entries: FileSystemEntry[]
): ChangeReport["codeStructure"] {
  // 函数和方法信息数组
  const functions: FunctionInfo[] = [];
  // 模块导入信息数组
  const modules: ModuleInfo[] = [];
  // 变量信息数组
  const variables: VariableInfo[] = [];
  // 注释信息数组
  const comments: CommentInfo[] = [];

  // 创建文件中的函数和方法映射
  const fileFunctionsMap = new Map<
    string,
    { name: string; type: string; lines: [number, number] }[]
  >();

  // 函数调用关系映射
  const functionCallsMap = new Map<string, Set<string>>();

  // 处理每个文件条目，提取函数和方法信息
  entries.forEach((entry) => {
    if (entry.type === "file" && entry.content) {
      // 提取函数和方法
      extractFunctionsAndMethods(
        entry.path,
        entry.content,
        fileFunctionsMap,
        functionCallsMap
      );

      // 提取模块导入
      const entryModules = extractModuleImports(entry.path, entry.content);
      modules.push(...entryModules);

      // 提取变量
      const entryVariables = extractVariables(entry.path, entry.content);
      variables.push(...entryVariables);

      // 提取注释
      const entryComments = extractComments(entry.path, entry.content);
      comments.push(...entryComments);
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
    totalFiles: entries.filter((entry) => entry.type === "file").length,
    totalFunctions: 0,
    totalMethods: 0,
    totalClasses: 0,
    totalLines: 0,
    totalModules: modules.length,
    totalVariables: variables.length,
    totalComments: comments.length,
  };

  // 计算总行数
  entries.forEach((entry) => {
    if (entry.type === "file" && entry.content) {
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
    modules,
    variables,
    comments,
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
    result += `- 总代码行数: ${stats.totalLines}\n`;
    result += `- 总模块导入数: ${stats.totalModules}\n`;
    result += `- 总变量数: ${stats.totalVariables}\n`;
    result += `- 总注释行数: ${stats.totalComments}\n\n`;

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

    // 添加模块导入信息
    if (stats.modules && stats.modules.length > 0) {
      result += "## 模块使用情况\n\n";

      // 按文件分组显示模块导入
      const moduleFileGroups = new Map<string, ModuleInfo[]>();
      stats.modules.forEach((mod) => {
        if (!moduleFileGroups.has(mod.filePath)) {
          moduleFileGroups.set(mod.filePath, []);
        }
        moduleFileGroups.get(mod.filePath)!.push(mod);
      });

      moduleFileGroups.forEach((modules, filePath) => {
        result += `### 文件: ${filePath}\n\n`;

        // 分为外部模块和内部模块
        const externalModules = modules.filter((m) => m.isExternal);
        const internalModules = modules.filter((m) => !m.isExternal);

        if (externalModules.length > 0) {
          result += "#### 外部模块:\n\n";
          externalModules.forEach((mod) => {
            result += `- ${mod.name}`;
            if (mod.importedItems && mod.importedItems.length > 0) {
              result += ` (导入: ${mod.importedItems.join(", ")})`;
            }
            result += `\n`;
          });
          result += "\n";
        }

        if (internalModules.length > 0) {
          result += "#### 内部模块:\n\n";
          internalModules.forEach((mod) => {
            result += `- ${mod.path}`;
            if (mod.importedItems && mod.importedItems.length > 0) {
              result += ` (导入: ${mod.importedItems.join(", ")})`;
            }
            result += `\n`;
          });
          result += "\n";
        }
      });
    }

    // 添加变量信息
    if (stats.variables && stats.variables.length > 0) {
      result += "## 变量定义\n\n";

      // 按文件分组显示变量
      const varFileGroups = new Map<string, VariableInfo[]>();
      stats.variables.forEach((v) => {
        if (!varFileGroups.has(v.filePath)) {
          varFileGroups.set(v.filePath, []);
        }
        varFileGroups.get(v.filePath)!.push(v);
      });

      varFileGroups.forEach((variables, filePath) => {
        result += `### 文件: ${filePath}\n\n`;

        // 分为常量和变量
        const constants = variables.filter((v) => v.isConst);
        const vars = variables.filter((v) => !v.isConst);

        if (constants.length > 0) {
          result += "#### 常量:\n\n";
          constants.forEach((v) => {
            result += `- ${v.name}`;
            if (v.type) {
              result += `: ${v.type}`;
            }
            if (v.value) {
              result += ` = ${v.value}`;
            }
            result += ` [行 ${v.line}]\n`;
          });
          result += "\n";
        }

        if (vars.length > 0) {
          result += "#### 变量:\n\n";
          vars.forEach((v) => {
            result += `- ${v.name}`;
            if (v.type) {
              result += `: ${v.type}`;
            }
            if (v.value) {
              result += ` = ${v.value}`;
            }
            result += ` [行 ${v.line}]\n`;
          });
          result += "\n";
        }
      });
    }

    // 添加重要注释信息
    if (stats.comments && stats.comments.length > 0) {
      const importantComments = stats.comments.filter((c) => c.isImportant);

      if (importantComments.length > 0) {
        result += "## 重要注释\n\n";

        // 按文件分组显示重要注释
        const commentFileGroups = new Map<string, CommentInfo[]>();
        importantComments.forEach((c) => {
          if (!commentFileGroups.has(c.filePath)) {
            commentFileGroups.set(c.filePath, []);
          }
          commentFileGroups.get(c.filePath)!.push(c);
        });

        commentFileGroups.forEach((comments, filePath) => {
          result += `### 文件: ${filePath}\n\n`;

          comments.forEach((c) => {
            result += `- [行 ${c.line}] ${c.type}注释: ${c.content.substring(
              0,
              100
            )}${c.content.length > 100 ? "..." : ""}\n`;
          });

          result += "\n";
        });
      }

      // 添加注释统计
      result += "## 注释统计\n\n";
      const singleLineComments = stats.comments.filter(
        (c) => c.type === "单行"
      ).length;
      const multiLineComments = stats.comments.filter(
        (c) => c.type === "多行"
      ).length;
      const docComments = stats.comments.filter(
        (c) => c.type === "文档"
      ).length;

      result += `- 单行注释: ${singleLineComments}\n`;
      result += `- 多行注释: ${multiLineComments}\n`;
      result += `- 文档注释: ${docComments}\n\n`;
    }
  }

  if (report.addedFiles.length > 0) {
    result += "## 新增文件和文件夹\n\n";
    report.addedFiles.forEach((file) => {
      const isDirectory = file.type === "directory";
      result += `- ${file.path}${isDirectory ? "/" : ""} ${
        isDirectory ? "[目录]" : ""
      }\n`;
    });
    result += "\n";
  }

  if (report.deletedFiles.length > 0) {
    result += "## 删除文件和文件夹\n\n";
    report.deletedFiles.forEach((file) => {
      const isDirectory = file.type === "directory";
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
      (file) => file.type === "file"
    ).length;
    const dirCount = report.allFiles.filter(
      (file) => file.type === "directory"
    ).length;

    result += `共计: ${report.allFiles.length} 个项目 (${fileCount} 个文件, ${dirCount} 个文件夹)\n\n`;

    report.allFiles.forEach((file) => {
      const isDirectory = file.type === "directory";
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

// 从文件内容中提取模块导入信息
function extractModuleImports(filePath: string, content: string): ModuleInfo[] {
  const moduleImports: ModuleInfo[] = [];
  const lines = content.split("\n");
  const fileExtension = filePath
    .substring(filePath.lastIndexOf("."))
    .toLowerCase();

  // 根据文件类型选择合适的正则表达式
  let importRegex;

  // JavaScript/TypeScript/React
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(fileExtension)) {
    // ES6 import 语法
    const es6ImportRegex =
      /import\s+(?:{([^}]+)}|(\*\s+as\s+\w+)|([^{}\s;]+))?\s*(?:from\s+)?['"]([^'"]+)['"]/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      // 创建一个新的正则表达式实例以重置lastIndex
      const regex = new RegExp(es6ImportRegex);

      while ((match = regex.exec(line)) !== null) {
        const namedImports = match[1]
          ? match[1].split(",").map((s) => s.trim())
          : [];
        const namespaceImport = match[2] ? match[2].trim() : null;
        const defaultImport = match[3] ? match[3].trim() : null;
        const path = match[4];

        // 确定模块名称
        let name = "";
        if (path.startsWith(".")) {
          // 相对路径导入，使用路径的最后一部分作为名称
          const parts = path.split("/");
          name = parts[parts.length - 1];
        } else {
          // 外部模块导入，使用路径作为名称
          name = path;
        }

        moduleImports.push({
          name,
          path,
          isExternal: !path.startsWith("."),
          importedItems: [
            ...namedImports,
            namespaceImport,
            defaultImport,
          ].filter(Boolean) as string[],
          filePath,
          line: i + 1,
        });
      }

      // 检查 require 语法
      const requireRegex =
        /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
      const requireRegexInstance = new RegExp(requireRegex);

      while ((match = requireRegexInstance.exec(line)) !== null) {
        const destructuredImports = match[1]
          ? match[1].split(",").map((s) => s.trim())
          : [];
        const defaultImport = match[2];
        const path = match[3];

        // 确定模块名称
        let name = "";
        if (path.startsWith(".")) {
          // 相对路径导入
          const parts = path.split("/");
          name = parts[parts.length - 1];
        } else {
          // 外部模块导入
          name = path;
        }

        moduleImports.push({
          name,
          path,
          isExternal: !path.startsWith("."),
          importedItems: [...destructuredImports, defaultImport].filter(
            Boolean
          ) as string[],
          filePath,
          line: i + 1,
        });
      }
    }
  }
  // Python
  else if ([".py"].includes(fileExtension)) {
    // 导入语法
    const importRegex =
      /(?:from\s+([.\w]+)\s+import\s+([^#\n]+)|import\s+([^#\n]+))/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      // 创建一个新的正则表达式实例以重置lastIndex
      const regex = new RegExp(importRegex);

      while ((match = regex.exec(line)) !== null) {
        if (match[1] && match[2]) {
          // from X import Y
          const path = match[1];
          const importedItems = match[2].split(",").map((s) => s.trim());

          moduleImports.push({
            name: path,
            path,
            isExternal: !path.startsWith("."),
            importedItems,
            filePath,
            line: i + 1,
          });
        } else if (match[3]) {
          // import X
          const imports = match[3].split(",").map((s) => s.trim());

          for (const importItem of imports) {
            const parts = importItem.split(" as ");
            const name = parts[0].trim();

            moduleImports.push({
              name,
              path: name,
              isExternal: !name.startsWith("."),
              filePath,
              line: i + 1,
            });
          }
        }
      }
    }
  }
  // Java
  else if ([".java"].includes(fileExtension)) {
    // 导入语法
    const importRegex = /import\s+(?:static\s+)?([^;]+);/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      // 创建一个新的正则表达式实例以重置lastIndex
      const regex = new RegExp(importRegex);

      while ((match = regex.exec(line)) !== null) {
        const path = match[1].trim();
        const parts = path.split(".");
        const name = parts[parts.length - 1];

        moduleImports.push({
          name,
          path,
          isExternal: true, // Java中所有导入都视为外部
          filePath,
          line: i + 1,
        });
      }
    }
  }

  return moduleImports;
}

// 从文件内容中提取变量信息
function extractVariables(filePath: string, content: string): VariableInfo[] {
  const variables: VariableInfo[] = [];
  const lines = content.split("\n");
  const fileExtension = filePath
    .substring(filePath.lastIndexOf("."))
    .toLowerCase();

  // 根据文件类型选择合适的正则表达式
  let varRegex;

  // JavaScript/TypeScript/React
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(fileExtension)) {
    // 变量声明正则表达式
    const jsVarRegex =
      /(?:const|let|var)\s+(\w+)(?::\s*([^=]+))?\s*=\s*([^;]+)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过注释行
      if (line.trim().startsWith("//") || line.trim().startsWith("/*")) {
        continue;
      }

      let match;
      // 创建一个新的正则表达式实例以重置lastIndex
      const regex = new RegExp(jsVarRegex);

      while ((match = regex.exec(line)) !== null) {
        const name = match[1];
        const type = match[2] ? match[2].trim() : undefined;
        const value = match[3] ? match[3].trim() : undefined;
        const isConst = line.trim().startsWith("const");

        variables.push({
          name,
          type,
          value,
          isConst,
          filePath,
          line: i + 1,
        });
      }

      // TypeScript 接口和类型定义
      if (fileExtension === ".ts" || fileExtension === ".tsx") {
        const tsTypeRegex = /(?:interface|type)\s+(\w+)(?:<[^>]+>)?\s*=/g;
        const tsTypeRegexInstance = new RegExp(tsTypeRegex);

        while ((match = tsTypeRegexInstance.exec(line)) !== null) {
          const name = match[1];

          variables.push({
            name,
            type: "type",
            isConst: true,
            filePath,
            line: i + 1,
          });
        }
      }
    }
  }
  // Python
  else if ([".py"].includes(fileExtension)) {
    // 变量赋值
    const pyVarRegex = /(\w+)\s*(?::\s*([^=]+))?\s*=\s*([^\n#]+)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过注释行
      if (line.trim().startsWith("#")) {
        continue;
      }

      let match;
      // 创建一个新的正则表达式实例以重置lastIndex
      const regex = new RegExp(pyVarRegex);

      while ((match = regex.exec(line)) !== null) {
        const name = match[1];
        const type = match[2] ? match[2].trim() : undefined;
        const value = match[3] ? match[3].trim() : undefined;

        // 排除函数调用和控制结构
        if (!["if", "for", "while", "def", "class"].includes(name)) {
          variables.push({
            name,
            type,
            value,
            isConst: false, // Python没有const关键字
            filePath,
            line: i + 1,
          });
        }
      }
    }
  }

  return variables;
}

// 从文件内容中提取注释信息
function extractComments(filePath: string, content: string): CommentInfo[] {
  const comments: CommentInfo[] = [];
  const lines = content.split("\n");
  const fileExtension = filePath
    .substring(filePath.lastIndexOf("."))
    .toLowerCase();

  // 重要标记正则表达式
  const importantMarkers = /TODO|FIXME|NOTE|HACK|BUG|XXX|OPTIMIZE|REVIEW/i;

  // 单行注释
  let singleLineCommentStart = "//";
  // 多行注释
  let multiLineCommentStart = "/*";
  let multiLineCommentEnd = "*/";
  // 文档注释
  let docCommentStart = "/**";

  // 根据文件类型设置注释标记
  if ([".py"].includes(fileExtension)) {
    singleLineCommentStart = "#";
    multiLineCommentStart = '"""';
    multiLineCommentEnd = '"""';
    docCommentStart = '"""';
  } else if ([".rb"].includes(fileExtension)) {
    singleLineCommentStart = "#";
    multiLineCommentStart = "=begin";
    multiLineCommentEnd = "=end";
  }

  // 处理单行注释
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 单行注释
    if (line.startsWith(singleLineCommentStart)) {
      const content = line.substring(singleLineCommentStart.length).trim();
      const isImportant = importantMarkers.test(content);

      comments.push({
        content,
        type: "单行",
        filePath,
        line: i + 1,
        isImportant,
      });
    }
  }

  // 处理多行注释
  let inMultiLineComment = false;
  let inDocComment = false;
  let commentStart = 0;
  let commentContent = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 文档注释开始
    if (
      line.trim().startsWith(docCommentStart) &&
      !inMultiLineComment &&
      !inDocComment
    ) {
      inDocComment = true;
      commentStart = i;
      commentContent = line.trim().substring(docCommentStart.length);
      continue;
    }

    // 多行注释开始
    if (
      line.trim().startsWith(multiLineCommentStart) &&
      !inMultiLineComment &&
      !inDocComment
    ) {
      inMultiLineComment = true;
      commentStart = i;
      commentContent = line.trim().substring(multiLineCommentStart.length);
      continue;
    }

    // 注释内容
    if (inMultiLineComment || inDocComment) {
      commentContent += "\n" + line.trim();
    }

    // 文档注释结束
    if (inDocComment && line.trim().endsWith(multiLineCommentEnd)) {
      inDocComment = false;
      commentContent = commentContent
        .substring(0, commentContent.length - multiLineCommentEnd.length)
        .trim();
      const isImportant = importantMarkers.test(commentContent);

      comments.push({
        content: commentContent,
        type: "文档",
        filePath,
        line: commentStart + 1,
        isImportant,
      });

      commentContent = "";
    }

    // 多行注释结束
    if (inMultiLineComment && line.trim().endsWith(multiLineCommentEnd)) {
      inMultiLineComment = false;
      commentContent = commentContent
        .substring(0, commentContent.length - multiLineCommentEnd.length)
        .trim();
      const isImportant = importantMarkers.test(commentContent);

      comments.push({
        content: commentContent,
        type: "多行",
        filePath,
        line: commentStart + 1,
        isImportant,
      });

      commentContent = "";
    }
  }

  return comments;
}
