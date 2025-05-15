// 判断是否为文本文件
export function isTextFile(filename: string): boolean {
  // 文本文件的扩展名列表
  const textExtensions = [
    ".txt",
    ".md",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".json",
    ".xml",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".conf",
    ".py",
    ".rb",
    ".java",
    ".c",
    ".cpp",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".swift",
    ".kt",
    ".sh",
    ".bat",
    ".ps1",
    ".svg",
    ".vue",
  ];

  // 获取文件扩展名并转小写
  const extension = getFileExtension(filename).toLowerCase();

  // 检查是否在文本文件扩展名列表中
  return textExtensions.includes(extension);
}

// 获取文件扩展名
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return ""; // 没有扩展名
  }
  return filename.slice(lastDotIndex);
}
