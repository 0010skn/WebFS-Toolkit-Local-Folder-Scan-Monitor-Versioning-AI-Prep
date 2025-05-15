// 注释分析结果类型
interface CommentAnalysisResult {
  isComment: boolean; // 是否为注释行
  isStartBlockComment: boolean; // 是否是块注释的开始
  isEndBlockComment: boolean; // 是否是块注释的结束
  commentText: string; // 提取的注释文本内容
}

// 语言配置类型
interface LanguageConfig {
  lineComment?: string[]; // 行注释标记
  blockCommentStart?: string[]; // 块注释开始标记
  blockCommentEnd?: string[]; // 块注释结束标记
}

// 各种语言的注释标记配置
const languageConfigs: Record<string, LanguageConfig> = {
  // JavaScript/TypeScript
  ".js": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
  ".jsx": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
  ".ts": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
  ".tsx": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // HTML/XML
  ".html": { blockCommentStart: ["<!--"], blockCommentEnd: ["-->"] },
  ".xml": { blockCommentStart: ["<!--"], blockCommentEnd: ["-->"] },
  ".svg": { blockCommentStart: ["<!--"], blockCommentEnd: ["-->"] },

  // CSS/SCSS
  ".css": { blockCommentStart: ["/*"], blockCommentEnd: ["*/"] },
  ".scss": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Python
  ".py": {
    lineComment: ["#"],
    blockCommentStart: ['"""', "'''"],
    blockCommentEnd: ['"""', "'''"],
  },

  // Ruby
  ".rb": {
    lineComment: ["#"],
    blockCommentStart: ["=begin"],
    blockCommentEnd: ["=end"],
  },

  // PHP
  ".php": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Shell
  ".sh": { lineComment: ["#"] },
  ".bash": { lineComment: ["#"] },

  // C/C++/C#/Java
  ".c": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
  ".cpp": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
  ".cs": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
  ".java": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Go
  ".go": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Rust
  ".rs": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Swift
  ".swift": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Kotlin
  ".kt": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Vue
  ".vue": {
    lineComment: ["//"],
    blockCommentStart: ["<!--", "/*"],
    blockCommentEnd: ["-->", "*/"],
  },

  // JSON (虽然JSON不支持注释，但有些环境允许)
  ".json": {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },

  // Markdown
  ".md": { blockCommentStart: ["<!--"], blockCommentEnd: ["-->"] },

  // 其他文件类型的默认配置
  default: {
    lineComment: ["//"],
    blockCommentStart: ["/*"],
    blockCommentEnd: ["*/"],
  },
};

/**
 * 解析一行代码中的注释
 * @param line 要分析的代码行
 * @param fileExtension 文件扩展名（用于确定注释格式）
 * @param inBlockComment 当前是否在块注释内
 * @returns 注释分析结果
 */
export function parseComments(
  line: string,
  fileExtension: string,
  inBlockComment: boolean = false
): CommentAnalysisResult {
  // 默认结果
  const result: CommentAnalysisResult = {
    isComment: false,
    isStartBlockComment: false,
    isEndBlockComment: false,
    commentText: "",
  };

  // 获取语言配置，如果没有特定配置则使用默认配置
  const config = languageConfigs[fileExtension] || languageConfigs["default"];

  // 如果已经在块注释中
  if (inBlockComment) {
    result.isComment = true;

    // 检查是否为块注释结束
    if (config.blockCommentEnd) {
      for (const endMark of config.blockCommentEnd) {
        if (line.trim().endsWith(endMark) || line.includes(endMark)) {
          result.isEndBlockComment = true;

          // 提取注释内容（去除结束标记）
          const endIndex = line.indexOf(endMark);
          result.commentText = line.substring(0, endIndex).trim();
          break;
        }
      }

      // 如果没有找到结束标记，整行都是注释
      if (!result.isEndBlockComment) {
        result.commentText = line.trim();
      }
    }

    return result;
  }

  // 检查行注释
  if (config.lineComment) {
    for (const commentMark of config.lineComment) {
      if (line.trim().startsWith(commentMark)) {
        result.isComment = true;
        result.commentText = line
          .substring(line.indexOf(commentMark) + commentMark.length)
          .trim();
        return result;
      }
    }
  }

  // 检查块注释开始
  if (config.blockCommentStart) {
    for (const startMark of config.blockCommentStart) {
      if (line.trim().startsWith(startMark)) {
        result.isComment = true;
        result.isStartBlockComment = true;

        // 检查是否在同一行结束
        if (config.blockCommentEnd) {
          for (const endMark of config.blockCommentEnd) {
            if (line.trim().endsWith(endMark)) {
              result.isEndBlockComment = true;

              // 提取注释内容（去除开始和结束标记）
              const startIndex = line.indexOf(startMark) + startMark.length;
              const endIndex = line.lastIndexOf(endMark);
              result.commentText = line.substring(startIndex, endIndex).trim();
              return result;
            }
          }
        }

        // 如果没有在同一行结束，提取开始部分
        result.commentText = line
          .substring(line.indexOf(startMark) + startMark.length)
          .trim();
        return result;
      }
    }
  }

  return result;
}
