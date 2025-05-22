// 声明全局类型来避免TypeScript错误
declare interface FileSystemSyncAccessHandle {}

// 文件系统条目类型
export interface FileSystemEntry {
  name: string; // 文件/文件夹名称
  path: string; // 相对路径
  type: "file" | "directory"; // 类型：文件或目录
  lastModified?: number; // 最后修改时间
  size?: number; // 文件大小（字节）
  content?: string; // 文件内容(仅用于文本文件的变更检测)
}

// 扫描结果类型
export interface ScanResult {
  entries: FileSystemEntry[]; // 所有条目，包括文件和目录
  timestamp: number; // 扫描时间戳
  codeStructure?: {
    functions: FunctionInfo[]; // 函数和方法信息
    modules: ModuleInfo[]; // 模块导入信息
    variables: VariableInfo[]; // 变量信息
    comments: CommentInfo[]; // 注释信息
    totalFiles?: number; // 总文件数
    totalFunctions?: number; // 总函数数
    totalMethods?: number; // 总方法数
    totalClasses?: number; // 总类数
    totalLines?: number; // 总代码行数
    totalModules?: number; // 总模块导入数
    totalVariables?: number; // 总变量数
    totalComments?: number; // 总注释行数
  };
}

// 文件变化记录类型
export interface FileSystemChangeRecord {
  type: "added" | "deleted" | "modified" | "renamed" | "appeared";
  changedHandle: FileSystemHandle;
  oldName?: string; // 用于重命名操作
}

// 文件系统观察者类型
export interface FileSystemObserver {
  observe(handle: FileSystemHandle | FileSystemSyncAccessHandle): Promise<void>;
  disconnect(): void;
}

// 文件系统观察者回调函数类型
export type FileSystemObserverCallback = (
  records: FileSystemChangeRecord[],
  observer: FileSystemObserver
) => void;

// 差异类型
export interface FileDiff {
  path: string;
  type: "added" | "deleted" | "modified";
  diff?: string;
  oldContent?: string;
  newContent?: string;
}

// 函数或方法信息
export interface FunctionInfo {
  name: string;
  type: "函数" | "方法" | "类" | "箭头函数";
  lines: [number, number]; // 开始行和结束行
  filePath: string;
  calls: string[]; // 调用的其他函数名称
}

// 模块导入信息
export interface ModuleInfo {
  name: string; // 模块名称
  path?: string; // 导入路径
  isExternal: boolean; // 是否为外部模块
  importedItems?: string[]; // 导入的项目（如具名导入）
  filePath: string; // 在哪个文件中导入
  line: number; // 在文件中的行号
}

// 变量信息
export interface VariableInfo {
  name: string; // 变量名称
  type?: string; // 变量类型（如果可以推断）
  value?: string; // 初始值（如果有）
  isConst: boolean; // 是否为常量
  filePath: string; // 在哪个文件中定义
  line: number; // 在文件中的行号
}

// 注释信息
export interface CommentInfo {
  content: string; // 注释内容
  type: "单行" | "多行" | "文档"; // 注释类型
  filePath: string; // 在哪个文件中
  line: number; // 在文件中的行号
  isImportant: boolean; // 是否包含重要标记（如TODO, FIXME, NOTE等）
}

// 变动报告类型
export interface ChangeReport {
  timestamp: number; // 报告时间戳
  fileChanges: FileChange[]; // 文件变更
  dirChanges: DirectoryChange[]; // 目录变更
  gitignoreRules: string[]; // 应用的 .gitignore 规则

  // 添加缺少的字段
  addedFiles: FileSystemEntry[]; // 新增的文件和文件夹
  deletedFiles: FileSystemEntry[]; // 删除的文件和文件夹
  modifiedFiles: FileDiff[]; // 修改的文件及其差异
  projectStructure: string; // 项目结构字符串表示
  codeStructure: any; // 代码结构信息
  allFiles?: FileSystemEntry[]; // 所有文件（可选，仅在showAllFiles=true时存在）
}

// 版本信息类型
export interface VersionInfo {
  backupTime: string; // ISO 8601 格式的备份时间戳
  versionTitle: string; // 用户提供的版本标题或自动生成的时间戳
}

// 版本历史记录类型
export interface VersionHistoryItem {
  versionTitle: string; // 版本标题
  backupTime: string; // 版本备份时间
  folderName: string; // 版本文件夹名称
}

// Docker相关类型
export interface Port {
  number: number;
  protocol: "tcp" | "udp";
}

export interface Instruction {
  type: string;
  value: string;
}

export interface Stage {
  name: string;
  baseImage: string;
  instructions: Instruction[];
}

export interface Dockerfile {
  baseImage?: string;
  stages?: Stage[];
  workdir?: string;
  exposedPorts?: Port[];
  entrypoint?: string;
  cmd?: string;
  env?: Record<string, string>;
  labels?: Record<string, string>;
  hasError?: boolean;
  errors?: string[];
  exists?: boolean; // 是否存在
  path?: string; // 路径
  content?: string; // 内容
}

// 环境变量文件类型
export interface EnvVariable {
  key: string;
  value: string;
  description?: string; // 描述或注释
  line: number; // 在文件中的行号
  isComment: boolean; // 是否为注释行
  isSensitive: boolean; // 是否包含敏感信息
}

export interface EnvFile {
  exists?: boolean; // 是否存在
  path?: string; // 路径
  content?: string; // 内容
  parsedEnv?: Record<string, string>; // 解析后的环境变量
  name?: string; // 文件名
  variables?: EnvVariable[]; // 解析后的环境变量列表
  hasError?: boolean; // 是否有错误
  errors?: string[]; // 错误信息
}

// Docker Compose 相关类型
export interface DockerComposeService {
  name: string;
  image?: string;
  build?: {
    context: string;
    dockerfile?: string;
  };
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  env_file?: string[];
  depends_on?: string[];
  networks?: string[];
}

export interface DockerComposeConfig {
  exists: boolean; // 是否存在
  path: string; // 路径
  content: string; // 内容
  parsedConfig?: any; // 解析后的配置(JSON)
  services?: string[]; // 服务列表
}

// 扫描状态类型
export type ScanStatus = "idle" | "scanning" | "preparing" | "error";

// 操作状态类型
export type OperationStatus = "idle" | "backing-up" | "restoring" | "error";

// 文件变更类型
export interface FileChange {
  path: string; // 文件路径
  type: "added" | "deleted" | "modified"; // 变更类型
  beforeContent?: string; // 修改前内容
  afterContent?: string; // 修改后内容
  diff?: string; // 差异文本
}

// 目录变更类型
export interface DirectoryChange {
  path: string; // 目录路径
  type: "added" | "deleted"; // 变更类型
}

// 版本管理配置类型
export interface VersionConfig {
  backupInterval: number; // 自动备份间隔（分钟，0表示禁用）
  maxBackups: number; // 最大备份数量
  backupPath: string; // 备份路径
}

// 配置类型
export interface AppConfig {
  theme: "light" | "dark" | "system"; // 主题
  language: string; // 语言
  autoScan: boolean; // 自动扫描
  scanInterval: number; // 扫描间隔（秒）
  versionConfig: VersionConfig; // 版本管理配置
}

// 用户设置类型
export interface UserSettings {
  theme: "light" | "dark" | "system"; // 主题
  language: string; // 语言
  autoScan: boolean; // 自动扫描
  scanInterval: number; // 扫描间隔（秒）
  enableNotifications: boolean; // 启用通知
  enableAutoBackup: boolean; // 启用自动备份
  backupInterval: number; // 备份间隔（分钟）
}

// Docker镜像标签类型
export interface DockerImageTag {
  name: string; // 标签名称
  description: string; // 标签描述
  isRecommended: boolean; // 是否推荐
}

// Docker容器基本配置类型
export interface DockerContainerConfig {
  name: string; // 容器名称
  image: string; // 镜像
  ports: string[]; // 端口映射
  environment: Record<string, string>; // 环境变量
  volumes: string[]; // 卷挂载
}

// 知识条目类型
export interface KnowledgeEntry {
  id: string; // 唯一标识符
  title: string; // 标题
  content: string; // Markdown格式内容
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

// 知识库存储状态
export interface KnowledgeStoreState {
  entries: KnowledgeEntry[]; // 知识条目列表
  isLoading: boolean; // 加载状态
  error: string | null; // 错误信息
  currentEntry: KnowledgeEntry | null; // 当前选中的条目
  searchQuery: string; // 搜索查询
}

// 知识库文件格式
export interface KnowledgeLibraryFile {
  version: string; // 文件版本号
  entries: KnowledgeEntry[]; // 知识条目数组
  exportedAt: string; // 导出时间
}
