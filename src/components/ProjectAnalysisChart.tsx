"use client";

import { useState, useEffect, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
  Background,
  Controls,
  MiniMap,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { useTranslations } from "./LocaleProvider";
import { themeAtom } from "../lib/store";
import { useAtom } from "jotai";
import { CodeStructure } from "../lib/codeStructureParser";

// 支持的语言类型
const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "csharp",
  "cpp",
  "go",
  "ruby",
  "php",
  "rust",
];

// 文件扩展名到语言的映射
const FILE_EXTENSION_MAP: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".c": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
  ".go": "go",
  ".rb": "ruby",
  ".php": "php",
  ".rs": "rust",
};

// 节点数据类型
interface NodeData {
  label: string;
  type: string;
  language?: string;
  file?: string;
  details?: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

// 主题类型
type ThemeType = "light" | "dark";

// 主题配置
const themeColors = {
  light: {
    class: "#3182ce", // 蓝色
    interface: "#38a169", // 绿色
    struct: "#d69e2e", // 黄色
    enum: "#805ad5", // 紫色
    function: "#dd6b20", // 橙色
    method: "#e53e3e", // 红色
    javascript: "#f6e05e", // 黄色
    typescript: "#3182ce", // 蓝色
    python: "#38a169", // 绿色
    java: "#ed8936", // 橙色
    csharp: "#9f7aea", // 紫色
    cpp: "#e53e3e", // 红色
    go: "#4299e1", // 淡蓝色
    ruby: "#f56565", // 红色
    php: "#667eea", // 靛蓝色
    rust: "#ed64a6", // 粉色
    background: "#f7fafc",
    text: "#1a202c",
    line: "#a0aec0",
  },
  dark: {
    class: "#4299e1", // 蓝色
    interface: "#48bb78", // 绿色
    struct: "#ecc94b", // 黄色
    enum: "#9f7aea", // 紫色
    function: "#ed8936", // 橙色
    method: "#fc8181", // 红色
    javascript: "#faf089", // 黄色
    typescript: "#4299e1", // 蓝色
    python: "#48bb78", // 绿色
    java: "#f6ad55", // 橙色
    csharp: "#b794f4", // 紫色
    cpp: "#fc8181", // 红色
    go: "#63b3ed", // 淡蓝色
    ruby: "#feb2b2", // 红色
    php: "#7f9cf5", // 靛蓝色
    rust: "#f687b3", // 粉色
    background: "#1a202c",
    text: "#f7fafc",
    line: "#4a5568",
  },
};

// 类型图标
const typeIcons: Record<string, string> = {
  class: "🧩",
  interface: "🔌",
  struct: "📦",
  enum: "🔢",
  function: "⚙️",
  method: "🔧",
  javascript: "📜",
  typescript: "📘",
  python: "🐍",
  java: "☕",
  csharp: "#️⃣",
  cpp: "🔄",
  go: "🐹",
  ruby: "💎",
  php: "🐘",
  rust: "⚙️",
  default: "📄",
};

// 自定义节点组件
const AnalysisNode = ({ data }: NodeProps<NodeData>) => {
  const [theme] = useAtom(themeAtom);
  const colors = themeColors[(theme as ThemeType) || "light"];

  // 获取节点类型的颜色
  const getColor = (type: string) => {
    return colors[type as keyof typeof colors] || colors.function;
  };

  const backgroundColor = getColor(data.type);
  const isExpanded = data.isExpanded;

  return (
    <div className="min-w-[180px] max-w-[300px] rounded-md border border-gray-300 dark:border-gray-600 shadow-md">
      <Handle type="target" position={Position.Top} />

      {/* 节点标题 */}
      <div
        className="px-3 py-2 rounded-t-md text-white flex justify-between items-center"
        style={{ backgroundColor }}
      >
        <div className="flex items-center">
          <span className="mr-2">
            {typeIcons[data.type] || typeIcons.default}
          </span>
          <div className="font-bold truncate">{data.label}</div>
        </div>

        {data.details && (
          <button
            onClick={() => data.onToggleExpand(data.label)}
            className="ml-2 text-xs px-1 py-0.5 bg-white bg-opacity-30 rounded hover:bg-opacity-50"
          >
            {isExpanded ? "−" : "+"}
          </button>
        )}
      </div>

      {/* 节点详情 */}
      {isExpanded && data.details && (
        <div className="p-2 bg-white dark:bg-gray-800 rounded-b-md">
          <div className="text-xs font-mono overflow-auto max-h-[150px]">
            {data.file && (
              <div className="mb-1 text-gray-600 dark:text-gray-400">
                {data.file}
              </div>
            )}
            {data.language && (
              <div className="mb-1 text-gray-600 dark:text-gray-400">
                语言: {data.language}
              </div>
            )}
            <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {data.details}
            </pre>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// 节点类型定义
const nodeTypes: NodeTypes = {
  analysisNode: AnalysisNode,
};

// 主组件
export default function ProjectAnalysisChart({
  structures,
  entries,
}: {
  structures: CodeStructure[];
  entries: FileSystemEntry[];
}) {
  const { t } = useTranslations();
  const [theme] = useAtom(themeAtom);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {}
  );
  const [filteredLanguages, setFilteredLanguages] =
    useState<string[]>(SUPPORTED_LANGUAGES);
  const [filteredTypes, setFilteredTypes] = useState<string[]>([
    "class",
    "interface",
    "struct",
    "enum",
    "function",
    "method",
  ]);
  const [showLabels, setShowLabels] = useState(true);

  // 切换节点展开状态
  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // 切换语言过滤器
  const toggleLanguageFilter = (language: string) => {
    setFilteredLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
  };

  // 切换类型过滤器
  const toggleTypeFilter = (type: string) => {
    setFilteredTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // 解析文件扩展名获取语言
  const getLanguageFromFileName = (fileName: string): string => {
    const extension = fileName
      .substring(fileName.lastIndexOf("."))
      .toLowerCase();
    return FILE_EXTENSION_MAP[extension] || "unknown";
  };

  // 创建节点和边
  useEffect(() => {
    if (!structures || structures.length === 0) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const nodeMap: Record<string, boolean> = {};

    // 根节点
    const rootId = "root";
    newNodes.push({
      id: rootId,
      type: "analysisNode",
      position: { x: 0, y: 0 },
      data: {
        label: "项目分析",
        type: "class",
        isExpanded: true,
        onToggleExpand: toggleNodeExpand,
      },
    });

    // 语言节点
    const languageNodes: Record<string, string> = {};

    // 统计每种语言的文件数量
    const languageStats: Record<string, number> = {};
    entries.forEach((entry) => {
      if (entry.kind === "file") {
        const language = getLanguageFromFileName(entry.name);
        if (language !== "unknown") {
          languageStats[language] = (languageStats[language] || 0) + 1;
        }
      }
    });

    // 创建语言节点
    let langIndex = 0;
    Object.entries(languageStats).forEach(([language, count]) => {
      if (SUPPORTED_LANGUAGES.includes(language)) {
        const langId = `lang-${language}`;
        languageNodes[language] = langId;

        newNodes.push({
          id: langId,
          type: "analysisNode",
          position: { x: -300 + langIndex * 150, y: 150 },
          data: {
            label: `${language} (${count})`,
            type: language,
            language,
            details: `文件数量: ${count}`,
            isExpanded: false,
            onToggleExpand: toggleNodeExpand,
          },
        });

        newEdges.push({
          id: `edge-root-${langId}`,
          source: rootId,
          target: langId,
          animated: false,
        });

        langIndex++;
      }
    });

    // 处理结构节点
    structures.forEach((structure, index) => {
      const language = getLanguageFromFileName(structure.file);
      if (!filteredLanguages.includes(language)) return;
      if (!filteredTypes.includes(structure.type.toLowerCase())) return;

      const structureId = `structure-${index}`;
      const details = [
        `${t("codeAnalysis.type")}: ${structure.type}`,
        `${t("codeAnalysis.fileCount")}: ${structure.file}`,
        `${t("codeAnalysis.line")}: ${structure.line}`,
        structure.extends
          ? `${t("codeAnalysis.inheritance")}: ${
              Array.isArray(structure.extends)
                ? structure.extends.join(", ")
                : structure.extends
            }`
          : null,
        structure.implements
          ? `${t("codeAnalysis.implementation")}: ${
              Array.isArray(structure.implements)
                ? structure.implements.join(", ")
                : structure.implements
            }`
          : null,
        `${t("codeAnalysis.memberCount")}: ${structure.members.length}`,
        `${t("codeAnalysis.methodCount")}: ${structure.methods.length}`,
      ]
        .filter(Boolean)
        .join("\n");

      // 添加结构节点
      newNodes.push({
        id: structureId,
        type: "analysisNode",
        position: {
          x: (index % 5) * 200,
          y: 300 + Math.floor(index / 5) * 150,
        },
        data: {
          label: structure.name,
          type: structure.type.toLowerCase(),
          language,
          file: structure.file,
          details,
          isExpanded: expandedNodes[structure.name] || false,
          onToggleExpand: toggleNodeExpand,
        },
      });

      nodeMap[structureId] = true;

      // 添加与语言节点的边
      if (languageNodes[language]) {
        newEdges.push({
          id: `edge-lang-${structureId}`,
          source: languageNodes[language],
          target: structureId,
          animated: false,
        });
      }

      // 处理继承和实现关系
      if (structure.extends) {
        const parentNames = Array.isArray(structure.extends)
          ? structure.extends
          : [structure.extends];
        parentNames.forEach((parentName) => {
          const parentStructure = structures.find((s) => s.name === parentName);
          if (parentStructure) {
            const parentId = `structure-${structures.indexOf(parentStructure)}`;
            if (nodeMap[parentId]) {
              newEdges.push({
                id: `edge-extends-${structureId}-${parentId}`,
                source: parentId,
                target: structureId,
                style: { stroke: "#3182ce" },
                label: showLabels ? t("codeAnalysis.inheritance") : "",
              });
            }
          }
        });
      }

      // 处理实现关系
      if (structure.implements) {
        const interfaceNames = Array.isArray(structure.implements)
          ? structure.implements
          : [structure.implements];
        interfaceNames.forEach((interfaceName) => {
          const interfaceStructure = structures.find(
            (s) => s.name === interfaceName
          );
          if (interfaceStructure) {
            const interfaceId = `structure-${structures.indexOf(
              interfaceStructure
            )}`;
            if (nodeMap[interfaceId]) {
              newEdges.push({
                id: `edge-implements-${structureId}-${interfaceId}`,
                source: interfaceId,
                target: structureId,
                style: { stroke: "#38a169", strokeDasharray: "5,5" },
                label: showLabels ? t("codeAnalysis.implementation") : "",
              });
            }
          }
        });
      }

      // 为每个方法创建节点
      structure.methods.forEach((method, methodIndex) => {
        if (!filteredTypes.includes("method")) return;

        const methodId = `method-${index}-${methodIndex}`;
        const methodDetails = [
          `${t("codeAnalysis.visibility")}: ${method.visibility || "public"}`,
          method.isStatic
            ? t("codeAnalysis.static")
            : t("codeAnalysis.instance"),
          `${t("codeAnalysis.parameters")}: ${
            method.params?.join(", ") || t("none")
          }`,
          `${t("codeAnalysis.returnType")}: ${method.returnType || "void"}`,
        ].join("\n");

        // 对每个结构只显示前3个方法节点，避免图表过于复杂
        if (methodIndex < 3) {
          newNodes.push({
            id: methodId,
            type: "analysisNode",
            position: {
              x: (index % 5) * 200 + 50 + methodIndex * 20,
              y: 300 + Math.floor(index / 5) * 150 + 100,
            },
            data: {
              label: method.name,
              type: "method",
              language,
              file: structure.file,
              details: methodDetails,
              isExpanded: expandedNodes[method.name] || false,
              onToggleExpand: toggleNodeExpand,
            },
          });

          // 添加与类的关系
          newEdges.push({
            id: `edge-method-${methodId}`,
            source: structureId,
            target: methodId,
            label: showLabels
              ? method.isStatic
                ? t("codeAnalysis.static")
                : t("codeAnalysis.instance")
              : "",
          });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    structures,
    entries,
    expandedNodes,
    filteredLanguages,
    filteredTypes,
    showLabels,
  ]);

  // 如果没有结构数据
  if (!structures || structures.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
        <p className="text-gray-600 dark:text-gray-300">
          {t("codeAnalysis.noAnalysisData")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[700px] bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        attributionPosition="bottom-right"
      >
        <Background
          color={themeColors[(theme as ThemeType) || "light"].line}
          gap={16}
          size={1}
        />
        <Controls />
        <MiniMap
          nodeStrokeColor={(n) => {
            const type = (n.data?.type || "default") as string;
            return (
              themeColors[(theme as ThemeType) || "light"][
                type as keyof typeof themeColors.light
              ] || "#ddd"
            );
          }}
          nodeColor={(n) => {
            const type = (n.data?.type || "default") as string;
            return (
              themeColors[(theme as ThemeType) || "light"][
                type as keyof typeof themeColors.light
              ] || "#ddd"
            );
          }}
          maskColor={
            themeColors[(theme as ThemeType) || "light"].background + "80"
          }
        />

        {/* 过滤器面板 */}
        <Panel
          position="top-left"
          className="bg-white dark:bg-gray-800 p-2 rounded-md shadow-md mb-2 overflow-y-auto max-h-[600px]"
        >
          <div className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t("codeAnalysis.languageFilter")}
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language}
                className={`px-2 py-1 rounded-md text-xs ${
                  filteredLanguages.includes(language)
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                }`}
                onClick={() => toggleLanguageFilter(language)}
              >
                {language}
              </button>
            ))}
          </div>

          <div className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t("codeAnalysis.typeFilter")}
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {["class", "interface", "struct", "enum", "function", "method"].map(
              (type) => (
                <button
                  key={type}
                  className={`px-2 py-1 rounded-md text-xs ${
                    filteredTypes.includes(type)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                  onClick={() => toggleTypeFilter(type)}
                >
                  {type}
                </button>
              )
            )}
          </div>

          <div className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t("codeAnalysis.displayOptions")}
          </div>
          <div className="flex items-center mb-1">
            <input
              type="checkbox"
              id="show-labels"
              checked={showLabels}
              onChange={() => setShowLabels(!showLabels)}
              className="mr-2"
            />
            <label
              htmlFor="show-labels"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              {t("codeAnalysis.showRelationLabels")}
            </label>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// 声明 FileSystemEntry 类型
interface FileSystemEntry {
  name: string;
  kind: "file" | "directory";
  path: string;
  lastModified?: number;
  size?: number;
  content?: string;
}
