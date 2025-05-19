/**
 * 知识库服务
 * 使用IndexedDB实现本地知识库存储
 */

// 知识条目类型定义
export interface KnowledgeEntry {
  id: string; // 唯一标识符
  title: string; // 标题
  content: string; // Markdown格式内容
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

// 知识库文件格式(.kn)定义
export interface KnowledgeLibraryFile {
  version: string; // 文件版本号
  entries: KnowledgeEntry[]; // 知识条目数组
  exportedAt: string; // 导出时间
}

// 数据库配置
const DB_NAME = "folda-scan-knowledge";
const DB_VERSION = 1;
const STORE_NAME = "knowledge-entries";

/**
 * 初始化数据库
 */
export async function initKnowledgeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // 创建/升级数据库结构
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 如果知识条目存储不存在，则创建
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });

        // 创建索引
        store.createIndex("title", "title", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error(
        "知识库数据库初始化失败:",
        (event.target as IDBOpenDBRequest).error
      );
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * 添加知识条目
 */
export async function addKnowledgeEntry(
  entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt">
): Promise<KnowledgeEntry> {
  const db = await initKnowledgeDB();

  // 生成唯一ID和时间戳
  const now = new Date().toISOString();
  const newEntry: KnowledgeEntry = {
    id: `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: entry.title,
    content: entry.content,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.add(newEntry);

    request.onsuccess = () => {
      resolve(newEntry);
    };

    request.onerror = (event) => {
      console.error("添加知识条目失败:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 获取所有知识条目
 */
export async function getAllKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  const db = await initKnowledgeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("updatedAt"); // 使用更新时间排序

    const request = index.getAll();

    request.onsuccess = (event) => {
      const entries = (event.target as IDBRequest<KnowledgeEntry[]>).result;
      // 按更新时间降序排序
      resolve(
        entries.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
    };

    request.onerror = (event) => {
      console.error("获取知识条目失败:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 获取单个知识条目
 */
export async function getKnowledgeEntry(
  id: string
): Promise<KnowledgeEntry | null> {
  const db = await initKnowledgeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(id);

    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest<KnowledgeEntry>).result || null);
    };

    request.onerror = (event) => {
      console.error("获取知识条目失败:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 更新知识条目
 */
export async function updateKnowledgeEntry(
  id: string,
  updates: Partial<KnowledgeEntry>
): Promise<KnowledgeEntry> {
  const db = await initKnowledgeDB();

  // 先获取现有条目
  const existingEntry = await getKnowledgeEntry(id);
  if (!existingEntry) {
    throw new Error(`找不到ID为 ${id} 的知识条目`);
  }

  // 创建更新后的条目
  const updatedEntry: KnowledgeEntry = {
    ...existingEntry,
    ...updates,
    updatedAt: new Date().toISOString(),
    id: existingEntry.id, // 确保ID不变
    createdAt: existingEntry.createdAt, // 确保创建时间不变
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put(updatedEntry);

    request.onsuccess = () => {
      resolve(updatedEntry);
    };

    request.onerror = (event) => {
      console.error("更新知识条目失败:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 删除知识条目
 */
export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const db = await initKnowledgeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      console.error("删除知识条目失败:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 导出知识库为.kn格式
 */
export async function exportKnowledgeLibrary(): Promise<KnowledgeLibraryFile> {
  const entries = await getAllKnowledgeEntries();

  const libraryFile: KnowledgeLibraryFile = {
    version: "1.0",
    entries,
    exportedAt: new Date().toISOString(),
  };

  return libraryFile;
}

/**
 * 导入知识库
 * 采用合并策略处理冲突
 */
export async function importKnowledgeLibrary(
  libraryFile: KnowledgeLibraryFile
): Promise<{ total: number; added: number; updated: number }> {
  // 验证导入文件格式
  if (!libraryFile.version || !Array.isArray(libraryFile.entries)) {
    throw new Error("知识库文件格式无效");
  }

  const db = await initKnowledgeDB();
  let added = 0;
  let updated = 0;

  // 获取现有条目的ID
  const existingEntries = await getAllKnowledgeEntries();
  const existingIds = new Set(existingEntries.map((entry) => entry.id));

  // 处理每个导入的条目
  for (const entry of libraryFile.entries) {
    if (existingIds.has(entry.id)) {
      // 如果条目已存在，获取现有条目
      const existingEntry = await getKnowledgeEntry(entry.id);

      // 如果导入条目的更新时间比现有条目新，则更新
      if (
        existingEntry &&
        new Date(entry.updatedAt) > new Date(existingEntry.updatedAt)
      ) {
        await updateKnowledgeEntry(entry.id, {
          title: entry.title,
          content: entry.content,
          updatedAt: entry.updatedAt,
        });
        updated++;
      }
    } else {
      // 添加新条目，保留原始ID和时间戳
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as IDBRequest).error);
      });
      added++;
    }
  }

  db.close();

  return {
    total: libraryFile.entries.length,
    added,
    updated,
  };
}

/**
 * 搜索知识条目 (按标题)
 */
export async function searchKnowledgeEntries(
  query: string
): Promise<KnowledgeEntry[]> {
  const entries = await getAllKnowledgeEntries();

  if (!query.trim()) {
    return entries;
  }

  const searchTerms = query.toLowerCase().split(" ").filter(Boolean);

  return entries.filter((entry) => {
    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();

    // 检查每个搜索词是否出现在标题或内容中
    return searchTerms.every(
      (term) => titleLower.includes(term) || contentLower.includes(term)
    );
  });
}

/**
 * 清空知识库
 */
export async function clearKnowledgeLibrary(): Promise<void> {
  const db = await initKnowledgeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      console.error("清空知识库失败:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}
