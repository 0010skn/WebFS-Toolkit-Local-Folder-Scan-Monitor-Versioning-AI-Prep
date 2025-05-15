// 代码结构类型定义
export type CodeStructureType =
  | "class"
  | "interface"
  | "struct"
  | "enum"
  | "function"
  | "unknown";

// 代码成员类型定义
export interface CodeMember {
  name: string;
  type: string;
  visibility?:
    | "public"
    | "private"
    | "protected"
    | "internal"
    | "package"
    | "unknown";
  isStatic?: boolean;
  params?: string[];
  returnType?: string;
}

// 代码结构定义
export interface CodeStructure {
  type: CodeStructureType;
  name: string;
  file: string;
  line: number;
  extends?: string[];
  implements?: string[];
  members: CodeMember[];
  methods: CodeMember[];
}

// 解析配置
interface ParserConfig {
  classRegex: RegExp[];
  interfaceRegex: RegExp[];
  structRegex: RegExp[];
  enumRegex: RegExp[];
  methodRegex: RegExp[];
  propertyRegex: RegExp[];
  extendsRegex?: RegExp[];
  implementsRegex?: RegExp[];
}

// 不同编程语言的解析配置
const parserConfigs: Record<string, ParserConfig> = {
  // TypeScript 配置
  ".ts": {
    classRegex: [
      /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g,
    ],
    interfaceRegex: [/interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?/g],
    structRegex: [], // TypeScript没有struct关键字，使用interface
    enumRegex: [/enum\s+(\w+)/g],
    methodRegex: [
      /(public|private|protected)?\s*(static)?\s*(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{;]*))?/g,
    ],
    propertyRegex: [
      /(public|private|protected)?\s*(static)?\s*(\w+)\s*:\s*([^;=]*)/g,
    ],
    extendsRegex: [/extends\s+([\w,\s]+)/g],
    implementsRegex: [/implements\s+([\w,\s]+)/g],
  },

  // JavaScript 配置
  ".js": {
    classRegex: [/class\s+(\w+)(?:\s+extends\s+(\w+))?/g],
    interfaceRegex: [], // JavaScript没有内置的interface关键字
    structRegex: [], // JavaScript没有struct关键字
    enumRegex: [], // JavaScript没有内置的enum关键字
    methodRegex: [
      /(?:static\s+)?(\w+)\s*\(([^)]*)\)/g,
      /(get|set)\s+(\w+)\s*\(([^)]*)\)/g,
    ],
    propertyRegex: [
      /this\.(\w+)\s*=/g,
      /constructor\([^)]*\)\s*{[^}]*this\.(\w+)\s*=/g,
    ],
    extendsRegex: [/extends\s+(\w+)/g],
  },

  // Java 配置
  ".java": {
    classRegex: [
      /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g,
    ],
    interfaceRegex: [/interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?/g],
    structRegex: [], // Java没有struct关键字
    enumRegex: [/enum\s+(\w+)/g],
    methodRegex: [
      /(public|private|protected)\s+(static)?\s*(?:<[^>]*>)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)/g,
    ],
    propertyRegex: [
      /(public|private|protected)\s+(static)?\s+(final)?\s*(\w+(?:<[^>]*>)?)\s+(\w+)\s*(?:=|;)/g,
    ],
    extendsRegex: [/extends\s+(\w+)/g],
    implementsRegex: [/implements\s+([\w,\s]+)/g],
  },

  // C# 配置
  ".cs": {
    classRegex: [
      /class\s+(\w+)(?:\s*:\s*(?:([\w<>]+)(?:,\s*([\w,\s<>]+))?)?)/g,
    ],
    interfaceRegex: [/interface\s+(\w+)(?:\s*:\s*([\w,\s<>]+))?/g],
    structRegex: [/struct\s+(\w+)(?:\s*:\s*([\w,\s<>]+))?/g],
    enumRegex: [/enum\s+(\w+)/g],
    methodRegex: [
      /(public|private|protected|internal)\s+(static|virtual|override|abstract)?\s*(?:async\s+)?(\w+(?:<[^>]*>)?)\s+(\w+)\s*\(([^)]*)\)/g,
    ],
    propertyRegex: [
      /(public|private|protected|internal)\s+(static)?\s*(\w+(?:<[^>]*>)?)\s+(\w+)\s*(?:{|=>|;|=)/g,
      /(public|private|protected|internal)\s+(static)?\s*(\w+(?:<[^>]*>)?)\s+(\w+)\s*\{(?:\s*get\s*;)?\s*(?:set\s*;)?\s*\}/g,
    ],
    extendsRegex: [/:\s*([\w<>]+)/g],
    implementsRegex: [/,\s*([\w,\s<>]+)/g],
  },

  // Python 配置
  ".py": {
    classRegex: [/class\s+(\w+)(?:\s*\(\s*([\w,\s.]+)\s*\))?/g],
    interfaceRegex: [], // Python使用ABC或Protocol实现接口，但没有特定关键字
    structRegex: [], // Python没有struct关键字，通常使用dataclass或namedtuple
    enumRegex: [/class\s+(\w+)\s*\(\s*Enum\s*\)/g],
    methodRegex: [/def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]*))?\s*:/g],
    propertyRegex: [/self\.(\w+)\s*=/g, /@property\s*\n\s*def\s+(\w+)/g],
    extendsRegex: [/\(\s*([\w,\s.]+)\s*\)/g],
  },

  // Go 配置
  ".go": {
    classRegex: [], // Go没有class关键字，使用struct和interface
    interfaceRegex: [/type\s+(\w+)\s+interface\s*{/g],
    structRegex: [/type\s+(\w+)\s+struct\s*{/g],
    enumRegex: [], // Go没有enum关键字
    methodRegex: [
      /func\s*\(\s*(\w+)\s+\*?(\w+)\s*\)\s*(\w+)\s*\(([^)]*)\)(?:\s*\(?\s*([^{]*)\)?)?\s*{/g,
      /func\s+(\w+)\s*\(([^)]*)\)(?:\s*\(?\s*([^{]*)\)?)?\s*{/g,
    ],
    propertyRegex: [
      /(\w+)\s+([^{}\n]+)/g, // struct字段
    ],
  },

  // C++ 配置
  ".cpp": {
    classRegex: [
      /class\s+(\w+)(?:\s*:\s*(?:(public|private|protected)\s+([\w:,\s]+))?)/g,
    ],
    interfaceRegex: [], // C++没有interface关键字，通常使用纯虚基类
    structRegex: [
      /struct\s+(\w+)(?:\s*:\s*(?:(public|private|protected)\s+([\w:,\s]+))?)/g,
    ],
    enumRegex: [/enum(?:\s+class)?\s+(\w+)/g],
    methodRegex: [
      /(public|private|protected)?\s*(static|virtual|const)?\s*(\w+(?:<[^>]*>)?)\s+(\w+)\s*\(([^)]*)\)(?:\s*const)?/g,
    ],
    propertyRegex: [
      /(public|private|protected)?\s*(static)?\s*(?:const)?\s*(\w+(?:<[^>]*>)?)\s+(\w+)\s*(?:;|=)/g,
    ],
    extendsRegex: [/:\s*(?:public|private|protected)\s+([\w:,\s]+)/g],
  },

  // Rust 配置
  ".rs": {
    classRegex: [], // Rust没有class关键字，使用struct和impl
    interfaceRegex: [/trait\s+(\w+)(?:\s*:\s*([\w+\s]+))?\s*{/g],
    structRegex: [/struct\s+(\w+)(?:<[^>]*>)?\s*(?:\([^)]*\))?\s*(?:{|;)/g],
    enumRegex: [/enum\s+(\w+)(?:<[^>]*>)?\s*{/g],
    methodRegex: [
      /fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]*))?\s*(?:where[^{]*)?{/g,
    ],
    propertyRegex: [
      /(\w+)(?:\s*:\s*([^,}]*))/g, // struct字段
    ],
    implementsRegex: [
      /impl(?:<[^>]*>)?\s+(\w+)(?:<[^>]*>)?\s+for\s+(\w+)(?:<[^>]*>)?/g,
    ],
  },
};

/**
 * 解析代码中的结构（类、接口、结构体等）
 * @param code 代码内容
 * @param fileName 文件名（用于确定编程语言）
 * @param filePath 文件路径
 * @returns 解析出的代码结构数组
 */
export function parseCodeStructures(
  code: string,
  fileName: string,
  filePath: string
): CodeStructure[] {
  const extension = getFileExtension(fileName);
  const config = parserConfigs[extension] || findDefaultConfig(extension);

  if (!config) {
    return [];
  }

  const structures: CodeStructure[] = [];
  const lines = code.split("\n");

  // 解析类
  structures.push(
    ...parseStructuresByType(code, lines, config.classRegex, "class", filePath)
  );

  // 解析接口
  structures.push(
    ...parseStructuresByType(
      code,
      lines,
      config.interfaceRegex,
      "interface",
      filePath
    )
  );

  // 解析结构体
  structures.push(
    ...parseStructuresByType(
      code,
      lines,
      config.structRegex,
      "struct",
      filePath
    )
  );

  // 解析枚举
  structures.push(
    ...parseStructuresByType(code, lines, config.enumRegex, "enum", filePath)
  );

  // 提取继承和实现关系
  extractInheritance(structures, code, config);

  // 为每个结构解析成员和方法
  structures.forEach((structure) => {
    parseMembers(structure, code, config);
  });

  return structures;
}

/**
 * 根据扩展名查找默认的解析配置
 * @param extension 文件扩展名
 * @returns 匹配的解析配置或undefined
 */
function findDefaultConfig(extension: string): ParserConfig | undefined {
  // 根据扩展名猜测语言
  switch (extension) {
    case ".jsx":
    case ".mjs":
      return parserConfigs[".js"];
    case ".tsx":
      return parserConfigs[".ts"];
    case ".cc":
    case ".cxx":
    case ".hpp":
    case ".h":
      return parserConfigs[".cpp"];
    case ".scala":
    case ".kt":
    case ".groovy":
      return parserConfigs[".java"];
    case ".go":
      return parserConfigs[".go"];
    case ".py":
    case ".pyw":
    case ".pyi":
      return parserConfigs[".py"];
    default:
      return undefined;
  }
}

/**
 * 根据正则表达式解析特定类型的结构
 * @param code 代码内容
 * @param lines 代码行数组
 * @param regexList 正则表达式列表
 * @param type 结构类型
 * @param filePath 文件路径
 * @returns 解析出的结构数组
 */
function parseStructuresByType(
  code: string,
  lines: string[],
  regexList: RegExp[],
  type: CodeStructureType,
  filePath: string
): CodeStructure[] {
  const structures: CodeStructure[] = [];

  if (!regexList || regexList.length === 0) {
    return structures;
  }

  for (const regex of regexList) {
    let match;
    const resetRegex = new RegExp(regex.source, regex.flags);

    while ((match = resetRegex.exec(code)) !== null) {
      const name = match[1];

      // 计算行号
      const lineNumber = getLineNumber(code, match.index, lines);

      // 创建新结构
      const structure: CodeStructure = {
        type,
        name,
        file: filePath,
        line: lineNumber,
        members: [],
        methods: [],
      };

      // 根据正则捕获组判断是否有继承或实现
      if (match[2] && type !== "enum") {
        if (type === "interface") {
          structure.extends = match[2].split(",").map((s) => s.trim());
        } else if (type === "class" || type === "struct") {
          structure.extends = [match[2].trim()];
        }
      }

      if (match[3] && type === "class") {
        structure.implements = match[3].split(",").map((s) => s.trim());
      }

      structures.push(structure);
    }
  }

  return structures;
}

/**
 * 提取继承和实现关系
 * @param structures 结构数组
 * @param code 代码内容
 * @param config 解析配置
 */
function extractInheritance(
  structures: CodeStructure[],
  code: string,
  config: ParserConfig
): void {
  // 如果没有专门的表达式，就跳过
  if (!config.extendsRegex && !config.implementsRegex) {
    return;
  }

  // 提取继承关系
  if (config.extendsRegex) {
    for (const structure of structures) {
      if (structure.extends || structure.type === "enum") {
        continue;
      }

      const structCode = getStructureCode(code, structure.name, structure.type);
      if (!structCode) {
        continue;
      }

      for (const regex of config.extendsRegex) {
        const match = regex.exec(structCode);
        if (match && match[1]) {
          structure.extends = match[1].split(",").map((s) => s.trim());
          break;
        }
      }
    }
  }

  // 提取实现关系
  if (config.implementsRegex) {
    for (const structure of structures) {
      if (structure.implements || structure.type !== "class") {
        continue;
      }

      const structCode = getStructureCode(code, structure.name, structure.type);
      if (!structCode) {
        continue;
      }

      for (const regex of config.implementsRegex) {
        const match = regex.exec(structCode);
        if (match && match[1]) {
          structure.implements = match[1].split(",").map((s) => s.trim());
          break;
        }
      }
    }
  }
}

/**
 * 解析结构的成员和方法
 * @param structure 结构对象
 * @param code 代码内容
 * @param config 解析配置
 */
function parseMembers(
  structure: CodeStructure,
  code: string,
  config: ParserConfig
): void {
  const structCode = getStructureCode(code, structure.name, structure.type);
  if (!structCode) {
    return;
  }

  // 解析方法
  if (config.methodRegex && config.methodRegex.length > 0) {
    for (const regex of config.methodRegex) {
      let match;
      const resetRegex = new RegExp(regex.source, regex.flags);

      while ((match = resetRegex.exec(structCode)) !== null) {
        const methodName =
          structure.type === ("go" as CodeStructureType)
            ? match[3] || match[1]
            : structure.type === ("py" as CodeStructureType)
            ? match[1]
            : match[4] || match[3] || match[2];

        if (!methodName || methodName === "constructor") {
          continue; // 跳过构造函数或无效名称
        }

        const params =
          structure.type === ("go" as CodeStructureType)
            ? match[4]
            : match[5] || match[2] || "";
        const returnType =
          structure.type === ("go" as CodeStructureType)
            ? match[5]
            : match[3] || "";
        const visibility = match[1] as
          | "public"
          | "private"
          | "protected"
          | "internal"
          | undefined;
        const isStatic = !!match[2] && match[2].includes("static");

        structure.methods.push({
          name: methodName,
          type: "method",
          visibility: visibility || "public",
          isStatic,
          params: params
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p),
          returnType: returnType.trim(),
        });
      }
    }
  }

  // 解析属性
  if (config.propertyRegex && config.propertyRegex.length > 0) {
    for (const regex of config.propertyRegex) {
      let match;
      const resetRegex = new RegExp(regex.source, regex.flags);

      while ((match = resetRegex.exec(structCode)) !== null) {
        let propName,
          propType,
          visibility:
            | "public"
            | "private"
            | "protected"
            | "internal"
            | "package"
            | "unknown"
            | undefined,
          isStatic;

        // 不同语言有不同的捕获组结构
        if (structure.type === ("py" as CodeStructureType)) {
          propName = match[1];
          propType = "any";
          visibility = "public";
          isStatic = false;
        } else if (structure.type === ("go" as CodeStructureType)) {
          propName = match[1];
          propType = match[2] ? match[2].trim() : "any";
          // Go中首字母大写为public，小写为private
          visibility = /^[A-Z]/.test(propName) ? "public" : "private";
          isStatic = false;
        } else {
          visibility = match[1] as
            | "public"
            | "private"
            | "protected"
            | "internal"
            | undefined;
          isStatic = !!match[2] && match[2].includes("static");
          propType = match[3] || match[4] || "any";
          propName = match[4] || match[5] || match[1];
        }

        if (propName) {
          structure.members.push({
            name: propName.trim(),
            type: propType.trim(),
            visibility: visibility || "public",
            isStatic,
          });
        }
      }
    }
  }
}

/**
 * 获取结构定义的代码块
 * @param code 完整代码
 * @param structureName 结构名称
 * @param type 结构类型
 * @returns 结构定义的代码块
 */
function getStructureCode(
  code: string,
  structureName: string,
  type: CodeStructureType
): string | null {
  const keywords: Record<CodeStructureType, string> = {
    class: "class",
    interface: "interface",
    struct: "struct",
    enum: "enum",
    function: "function",
    unknown: "",
  };

  const keyword = keywords[type];
  if (!keyword) {
    return null;
  }

  const regex = new RegExp(
    `${keyword}\\s+${structureName}[^{]*{([\\s\\S]*?})`,
    "g"
  );
  const match = regex.exec(code);

  if (match && match[1]) {
    return match[0]; // 返回整个结构定义
  }

  return null;
}

/**
 * 获取匹配位置对应的行号
 * @param code 代码内容
 * @param position 字符位置
 * @param lines 代码行数组
 * @returns 行号（从1开始）
 */
function getLineNumber(
  code: string,
  position: number,
  lines: string[]
): number {
  const textBeforeMatch = code.substring(0, position);
  return textBeforeMatch.split("\n").length;
}

/**
 * 获取文件扩展名
 * @param fileName 文件名
 * @returns 扩展名（包含点）
 */
function getFileExtension(fileName: string): string {
  const extMatch = fileName.match(/(\.[^.]+)$/);
  return extMatch ? extMatch[1].toLowerCase() : "";
}

/**
 * 清理代码，移除注释和字符串，便于解析
 * @param code 原始代码
 * @returns 清理后的代码
 */
export function cleanCode(code: string): string {
  // 移除行注释
  let clean = code.replace(/\/\/.*$/gm, "");

  // 移除块注释
  clean = clean.replace(/\/\*[\s\S]*?\*\//gm, "");

  // 移除字符串字面量
  clean = clean.replace(/"([^"\\]|\\.)*"/g, '""');
  clean = clean.replace(/'([^'\\]|\\.)*'/g, "''");

  return clean;
}
