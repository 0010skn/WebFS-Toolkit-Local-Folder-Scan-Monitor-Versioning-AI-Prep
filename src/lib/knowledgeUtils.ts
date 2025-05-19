/**
 * 知识库工具函数
 */
import {
  exportKnowledgeLibrary,
  importKnowledgeLibrary,
  KnowledgeLibraryFile,
  addKnowledgeEntry,
} from "./knowledgeService";
import JSZip from "jszip";

/**
 * 文件下载处理程序
 * @param blob 文件数据
 * @param filename 文件名
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 导出知识库为.kn文件
 */
export async function downloadKnowledgeLibrary(): Promise<void> {
  try {
    const libraryData = await exportKnowledgeLibrary();
    const blob = new Blob([JSON.stringify(libraryData, null, 2)], {
      type: "application/json",
    });

    // 使用日期生成文件名
    const date = new Date().toISOString().split("T")[0];
    downloadBlob(blob, `folda-scan-knowledge-${date}.kn`);
  } catch (error) {
    console.error("导出知识库失败:", error);
    throw new Error("导出知识库失败");
  }
}

/**
 * 从.md文件创建知识条目内容
 */
export function parseMarkdownFile(
  file: File
): Promise<{ title: string; content: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;

        if (!content) {
          throw new Error("无法读取文件内容");
        }

        // 尝试从文件名或Markdown内容中提取标题
        const filename = file.name.replace(/\.md$/, "");

        // 从Markdown内容的第一个#标题中提取标题
        let title = filename;
        const headerMatch = content.match(/^#\s+(.+)$/m);
        if (headerMatch && headerMatch[1]) {
          title = headerMatch[1].trim();
        }

        resolve({ title, content });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

/**
 * 解析导入的.kn文件
 */
export function parseKnowledgeFile(file: File): Promise<KnowledgeLibraryFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;

        if (!content) {
          throw new Error("无法读取文件内容");
        }

        const libraryData = JSON.parse(content) as KnowledgeLibraryFile;

        // 验证格式
        if (!libraryData.version || !Array.isArray(libraryData.entries)) {
          throw new Error("文件格式无效");
        }

        resolve(libraryData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

/**
 * 导入知识库文件
 */
export async function importKnowledgeFile(
  file: File
): Promise<{ total: number; added: number; updated: number }> {
  try {
    // 验证文件扩展名
    if (!file.name.endsWith(".kn")) {
      throw new Error("请选择.kn格式的知识库文件");
    }

    const libraryData = await parseKnowledgeFile(file);
    return await importKnowledgeLibrary(libraryData);
  } catch (error) {
    console.error("导入知识库失败:", error);
    throw error;
  }
}

/**
 * 从ZIP文件导入多个Markdown文件作为知识条目
 * @param file ZIP文件
 */
export async function importZipFile(
  file: File
): Promise<{ total: number; imported: number }> {
  try {
    // 验证文件扩展名
    if (!file.name.toLowerCase().endsWith(".zip")) {
      throw new Error("请选择.zip格式的文件");
    }

    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    let total = 0;
    let imported = 0;

    // 创建处理单个文件的函数
    const processMarkdownFile = async (filename: string, content: string) => {
      // 只处理.md文件
      if (!filename.toLowerCase().endsWith(".md")) {
        return false;
      }

      try {
        // 尝试从文件名或Markdown内容中提取标题
        const filenameWithoutExt =
          filename.replace(/\.md$/i, "").split("/").pop() || "";

        // 从Markdown内容的第一个#标题中提取标题
        let title = filenameWithoutExt;
        const headerMatch = content.match(/^#\s+(.+)$/m);
        if (headerMatch && headerMatch[1]) {
          title = headerMatch[1].trim();
        }

        // 添加为知识条目
        await addKnowledgeEntry({
          title,
          content,
        });

        return true;
      } catch (error) {
        console.error(`处理文件 ${filename} 时出错:`, error);
        return false;
      }
    };

    // 处理所有文件
    const promises: Promise<boolean>[] = [];

    zipContent.forEach((relativePath, zipEntry) => {
      // 跳过目录
      if (!zipEntry.dir) {
        total++;
        const promise = zipEntry.async("string").then((content) => {
          return processMarkdownFile(relativePath, content);
        });
        promises.push(promise);
      }
    });

    // 等待所有文件处理完成
    const results = await Promise.all(promises);
    imported = results.filter(Boolean).length;

    return { total, imported };
  } catch (error) {
    console.error("导入ZIP文件失败:", error);
    throw error;
  }
}
