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
} from "reactflow";
import "reactflow/dist/style.css";
import { useTranslations } from "./LocaleProvider";
import { themeAtom } from "../lib/store";
import { useAtom } from "jotai";

// 配置文件类型
interface ConfigFile {
  name: string;
  path: string;
  type: string;
  content?: string;
  dependencies?: string[];
}

// 获取文件类型
const getFileType = (fileName: string): string => {
  if (fileName.includes("config")) return "config";
  if (fileName.endsWith(".json")) return "config";
  if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) return "config";
  if (fileName.endsWith(".toml") || fileName.endsWith(".ini")) return "config";
  if (fileName.startsWith(".")) return "config";
  return "default";
};

// 节点数据类型
interface NodeData {
  label: string;
  type: string;
  path?: string;
  content?: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

// 主题类型
type ThemeType = "light" | "dark";

// 主题配置
const themeColors = {
  light: {
    config: "#3182ce", // 蓝色
    component: "#38a169", // 绿色
    page: "#d69e2e", // 黄色
    api: "#805ad5", // 紫色
    lib: "#dd6b20", // 橙色
    public: "#e53e3e", // 红色
    background: "#f7fafc",
    text: "#1a202c",
    line: "#a0aec0",
  },
  dark: {
    config: "#4299e1", // 蓝色
    component: "#48bb78", // 绿色
    page: "#ecc94b", // 黄色
    api: "#9f7aea", // 紫色
    lib: "#ed8936", // 橙色
    public: "#fc8181", // 红色
    background: "#1a202c",
    text: "#f7fafc",
    line: "#4a5568",
  },
};

// 文件类型图标
const fileIcons: Record<string, string> = {
  config: "⚙️",
  component: "🧩",
  page: "📄",
  api: "🔌",
  lib: "📚",
  public: "🌐",
  default: "📁",
};

// 自定义节点组件
const ConfigNode = ({ data }: NodeProps<NodeData>) => {
  const [theme] = useAtom(themeAtom);
  const colors = themeColors[(theme as ThemeType) || "light"];

  // 获取节点类型的颜色
  const getColor = (type: string) => {
    return colors[type as keyof typeof colors] || colors.config;
  };

  const backgroundColor = getColor(data.type);
  const isExpanded = data.isExpanded;

  return (
    <div className="min-w-[200px] max-w-[300px] rounded-md border border-gray-300 dark:border-gray-600 shadow-md">
      <Handle type="target" position={Position.Top} />

      {/* 节点标题 */}
      <div
        className="px-3 py-2 rounded-t-md text-white flex justify-between items-center"
        style={{ backgroundColor }}
      >
        <div className="flex items-center">
          <span className="mr-2">
            {fileIcons[data.type] || fileIcons.default}
          </span>
          <div className="font-bold truncate">{data.label}</div>
        </div>

        {data.content && (
          <button
            onClick={() => data.onToggleExpand(data.path || "")}
            className="ml-2 text-xs px-1 py-0.5 bg-white bg-opacity-30 rounded hover:bg-opacity-50"
          >
            {isExpanded ? "−" : "+"}
          </button>
        )}
      </div>

      {/* 节点内容 */}
      {isExpanded && data.content && (
        <div className="p-2 bg-white dark:bg-gray-800 rounded-b-md">
          <div className="text-xs font-mono overflow-auto max-h-[200px]">
            <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {data.content}
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
  configNode: ConfigNode,
};

// 主组件
export default function ProjectConfigVisualizer({
  entries,
}: {
  entries: FileSystemEntry[];
}) {
  const { t } = useTranslations();
  const [theme] = useAtom(themeAtom);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {}
  );

  // 配置文件列表
  const configFiles = useMemo(() => {
    const configs: ConfigFile[] = [];

    // 扫描配置文件
    entries.forEach((entry) => {
      if (entry.kind === "file") {
        const fileName = entry.name.toLowerCase();

        // 检查是否为配置文件
        if (
          fileName.includes("config") ||
          fileName.endsWith(".json") ||
          fileName.endsWith(".yaml") ||
          fileName.endsWith(".yml") ||
          fileName.endsWith(".toml") ||
          fileName.endsWith(".ini") ||
          fileName === ".env" ||
          fileName === ".gitignore" ||
          fileName.startsWith(".") // 大多数配置文件都是以点开头的隐藏文件
        ) {
          const fileType = getFileType(fileName);
          configs.push({
            name: entry.name,
            path: entry.path,
            type: fileType,
            content: entry.content,
          });
        }
      }
    });

    return configs;
  }, [entries]);

  // 切换节点展开状态
  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // 创建节点和边
  useEffect(() => {
    if (configFiles.length === 0) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // 创建根节点
    newNodes.push({
      id: "root",
      type: "configNode",
      position: { x: 0, y: 0 },
      data: {
        label: "项目配置",
        type: "config",
        isExpanded: true,
        onToggleExpand: toggleNodeExpand,
      },
    });

    // 创建配置文件节点
    configFiles.forEach((file, index) => {
      const nodeId = `config-${index}`;

      // 添加节点
      newNodes.push({
        id: nodeId,
        type: "configNode",
        position: {
          x: (index % 3) * 350 - 350,
          y: Math.floor(index / 3) * 300 + 150,
        },
        data: {
          label: file.name,
          type: file.type,
          path: file.path,
          content: file.content,
          isExpanded: expandedNodes[file.path] || false,
          onToggleExpand: toggleNodeExpand,
        },
      });

      // 添加边
      newEdges.push({
        id: `edge-root-${nodeId}`,
        source: "root",
        target: nodeId,
        animated: true,
      });
    });

    // 添加项目架构节点
    const architectureNodes = [
      { id: "arch-pages", label: "页面", type: "page", x: 350, y: 100 },
      {
        id: "arch-components",
        label: "组件",
        type: "component",
        x: 350,
        y: 300,
      },
      { id: "arch-lib", label: "库函数", type: "lib", x: 350, y: 500 },
      { id: "arch-public", label: "静态资源", type: "public", x: 700, y: 200 },
      { id: "arch-api", label: "API", type: "api", x: 700, y: 400 },
    ];

    // 添加架构节点
    architectureNodes.forEach((node) => {
      newNodes.push({
        id: node.id,
        type: "configNode",
        position: { x: node.x, y: node.y },
        data: {
          label: node.label,
          type: node.type,
          isExpanded: false,
          onToggleExpand: toggleNodeExpand,
        },
      });

      // 添加边
      newEdges.push({
        id: `edge-${node.id}`,
        source: "root",
        target: node.id,
        animated: false,
      });
    });

    // 设置架构节点之间的关系
    newEdges.push(
      {
        id: "edge-pages-components",
        source: "arch-pages",
        target: "arch-components",
      },
      {
        id: "edge-components-lib",
        source: "arch-components",
        target: "arch-lib",
      },
      { id: "edge-pages-api", source: "arch-pages", target: "arch-api" },
      { id: "edge-api-lib", source: "arch-api", target: "arch-lib" },
      { id: "edge-pages-public", source: "arch-pages", target: "arch-public" }
    );

    setNodes(newNodes);
    setEdges(newEdges);
  }, [configFiles, expandedNodes]);

  // 如果没有配置文件
  if (configFiles.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
        <p className="text-gray-600 dark:text-gray-300">
          {t("projectConfig.noConfigFiles")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
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
