"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  CodeStructure,
  CodeMember,
  CodeStructureType,
} from "../lib/codeStructureParser";
import { useTranslations } from "./LocaleProvider";

// 主题类型
type ThemeType = "light" | "dark";

// 主题颜色配置
const themeColors: Record<
  ThemeType,
  {
    class: string;
    interface: string;
    struct: string;
    enum: string;
    function: string;
    background: string;
    text: string;
    line: string;
  }
> = {
  light: {
    class: "#3182ce", // 蓝色
    interface: "#38a169", // 绿色
    struct: "#d69e2e", // 黄色
    enum: "#805ad5", // 紫色
    function: "#dd6b20", // 橙色
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
    background: "#1a202c",
    text: "#f7fafc",
    line: "#4a5568",
  },
};

// 节点类型图标映射
const typeIcons: Record<CodeStructureType | string, string> = {
  class: "🧩",
  interface: "🔌",
  struct: "📦",
  enum: "🔢",
  function: "⚙️",
  unknown: "❓",
};

// 可见性图标映射
const visibilityIcons: Record<string, string> = {
  public: "🌐",
  private: "🔒",
  protected: "🛡️",
  internal: "🏠",
  package: "📦",
  unknown: "❓",
};

// 节点数据类型
interface NodeData extends CodeStructure {
  id: string;
  theme: ThemeType;
  isExpanded: boolean;
  onToggleExpand: (nodeId: string) => void;
}

// 自定义节点组件
const StructureNode = ({ data }: NodeProps<NodeData>) => {
  const theme = data.theme as ThemeType;
  const { name, type, members, methods, file, line } = data;
  const colors = themeColors[theme];

  // 安全地访问颜色值
  const getColorForType = (type: string): string => {
    const key = type as keyof typeof colors;
    return key in colors ? colors[key] : colors.class;
  };

  // 节点标题样式
  const titleClass = `font-bold p-2 rounded-t-md text-white bg-${type}`;
  const titleStyle = {
    backgroundColor: getColorForType(type),
  };

  // 计算节点内容是否展开
  const isExpanded = data.isExpanded !== undefined ? data.isExpanded : true;

  return (
    <div className="min-w-[200px] max-w-[300px] rounded-md border border-gray-300 dark:border-gray-600 shadow-md">
      <Handle type="target" position={Position.Top} />

      {/* 节点标题 */}
      <div
        className="px-3 py-2 rounded-t-md text-white flex justify-between items-center"
        style={titleStyle}
      >
        <div className="flex items-center">
          <span className="mr-2">{typeIcons[type] || typeIcons.unknown}</span>
          <div>
            <div className="font-bold">{name}</div>
            <div className="text-xs opacity-80">
              {file.split("/").pop()}:{line}
            </div>
          </div>
        </div>
        <button
          onClick={() => data.onToggleExpand && data.onToggleExpand(data.id)}
          className="ml-2 text-xs px-1 py-0.5 bg-white bg-opacity-30 rounded hover:bg-opacity-50"
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {/* 节点内容 */}
      {isExpanded && (
        <div className="p-2 bg-white dark:bg-gray-800 rounded-b-md">
          {/* 成员 */}
          {members.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">
                成员
              </div>
              <ul className="text-sm">
                {members.map((member: CodeMember, index: number) => (
                  <li
                    key={`member-${index}`}
                    className="pl-1 truncate"
                    title={`${member.name}: ${member.type}`}
                  >
                    <span className="mr-1">
                      {visibilityIcons[member.visibility || "unknown"]}
                    </span>
                    <span className={member.isStatic ? "font-bold" : ""}>
                      {member.name}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      : {member.type}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 方法 */}
          {methods.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">
                方法
              </div>
              <ul className="text-sm">
                {methods.map((method: CodeMember, index: number) => (
                  <li
                    key={`method-${index}`}
                    className="pl-1 truncate"
                    title={`${method.name}(${method.params?.join(", ")}): ${
                      method.returnType || "void"
                    }`}
                  >
                    <span className="mr-1">
                      {visibilityIcons[method.visibility || "unknown"]}
                    </span>
                    <span className={method.isStatic ? "font-bold" : ""}>
                      {method.name}()
                    </span>
                    {method.returnType && (
                      <span className="text-gray-500 dark:text-gray-400">
                        : {method.returnType}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 继承和实现 */}
          {(data.extends || data.implements) && (
            <div className="mt-2 text-xs">
              {data.extends && (
                <div className="text-blue-600 dark:text-blue-400">
                  extends:{" "}
                  {Array.isArray(data.extends)
                    ? data.extends.join(", ")
                    : data.extends}
                </div>
              )}
              {data.implements && (
                <div className="text-green-600 dark:text-green-400">
                  implements:{" "}
                  {Array.isArray(data.implements)
                    ? data.implements.join(", ")
                    : data.implements}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// 定义节点类型映射
const nodeTypes: NodeTypes = {
  structureNode: StructureNode,
};

export function CodeStructureVisualizer({
  structures,
  theme = "light",
}: {
  structures: CodeStructure[];
  theme?: ThemeType;
}) {
  const { t } = useTranslations();
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {}
  );

  // 处理节点展开/折叠
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  // 处理节点变化
  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // 处理连线变化
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // 安全地获取颜色类型
  const getColor = (colorTheme: ThemeType, type: string): string => {
    const colors = themeColors[colorTheme];
    const key = type as keyof typeof colors;
    return key in colors ? colors[key] : colors.class;
  };

  // 根据结构创建节点和边
  useEffect(() => {
    if (!structures || structures.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 创建节点
    const newNodes: Node<NodeData>[] = structures.map((structure, index) => {
      const nodeId = `node-${structure.type}-${structure.name}-${index}`;
      return {
        id: nodeId,
        type: "structureNode",
        position: {
          x: 50 + (index % 3) * 320,
          y: 50 + Math.floor(index / 3) * 320,
        },
        data: {
          ...structure,
          id: nodeId,
          theme,
          isExpanded:
            expandedNodes[nodeId] !== undefined ? expandedNodes[nodeId] : true,
          onToggleExpand: handleToggleExpand,
        },
      };
    });

    // 创建边
    const newEdges: Edge[] = [];
    const nodeMap: Record<string, Node<NodeData>> = {};

    // 构建节点查找映射
    newNodes.forEach((node) => {
      nodeMap[node.data.name] = node;
    });

    // 创建继承关系的边
    structures.forEach((structure, index) => {
      const sourceId = `node-${structure.type}-${structure.name}-${index}`;

      // 处理继承关系
      if (structure.extends) {
        const extendsList = Array.isArray(structure.extends)
          ? structure.extends
          : [structure.extends];

        extendsList.forEach((extendName) => {
          // 查找父类节点
          const targetNode = Object.values(nodeMap).find(
            (node) => node.data.name === extendName
          );

          if (targetNode) {
            newEdges.push({
              id: `edge-extends-${sourceId}-${targetNode.id}`,
              source: sourceId,
              target: targetNode.id,
              type: "smoothstep",
              style: { stroke: getColor(theme, "class"), strokeWidth: 2 },
              label: "extends",
              labelStyle: { fill: getColor(theme, "text") },
              labelShowBg: false,
            });
          }
        });
      }

      // 处理实现关系
      if (structure.implements) {
        const implementsList = Array.isArray(structure.implements)
          ? structure.implements
          : [structure.implements];

        implementsList.forEach((interfaceName) => {
          // 查找接口节点
          const targetNode = Object.values(nodeMap).find(
            (node) => node.data.name === interfaceName
          );

          if (targetNode) {
            newEdges.push({
              id: `edge-implements-${sourceId}-${targetNode.id}`,
              source: sourceId,
              target: targetNode.id,
              type: "smoothstep",
              style: {
                stroke: getColor(theme, "interface"),
                strokeWidth: 2,
                strokeDasharray: "5,5",
              },
              label: "implements",
              labelStyle: { fill: getColor(theme, "text") },
              labelShowBg: false,
            });
          }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [structures, theme, expandedNodes, handleToggleExpand]);

  // 如果没有结构，显示提示信息
  if (!structures || structures.length === 0) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-gray-600 dark:text-gray-300">
          {t("codeStructure.noStructuresFound")}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "600px" }} className="border rounded-md">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color={getColor(theme, "line")} gap={16} size={1} />
        <Controls position="bottom-right" />
        <MiniMap
          nodeStrokeColor={(n: Node) => {
            const structureType = n.data?.type || "class";
            return getColor(theme, structureType);
          }}
          nodeColor={(n: Node) => {
            const structureType = n.data?.type || "class";
            return getColor(theme, structureType);
          }}
          nodeBorderRadius={3}
        />
      </ReactFlow>
    </div>
  );
}

// 统计数据展示组件
export function CodeStructureStats({
  structures,
  theme = "light",
}: {
  structures: CodeStructure[];
  theme?: ThemeType;
}) {
  const { t } = useTranslations();

  // 如果没有结构，显示提示信息
  if (!structures || structures.length === 0) {
    return null;
  }

  // 计算统计数据
  const stats = {
    total: structures.length,
    byType: {
      class: structures.filter((s) => s.type === "class").length,
      interface: structures.filter((s) => s.type === "interface").length,
      struct: structures.filter((s) => s.type === "struct").length,
      enum: structures.filter((s) => s.type === "enum").length,
      function: structures.filter((s) => s.type === "function").length,
    },
    membersTotal: structures.reduce((sum, s) => sum + s.members.length, 0),
    methodsTotal: structures.reduce((sum, s) => sum + s.methods.length, 0),
    avgMembers: structures.length
      ? (
          structures.reduce((sum, s) => sum + s.members.length, 0) /
          structures.length
        ).toFixed(1)
      : 0,
    avgMethods: structures.length
      ? (
          structures.reduce((sum, s) => sum + s.methods.length, 0) /
          structures.length
        ).toFixed(1)
      : 0,
  };

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
      <div
        className={`p-4 rounded-lg shadow ${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="text-lg font-semibold mb-1">
          {t("codeStructure.totalStructures")}
        </div>
        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
          {stats.total}
        </div>
        <div className="flex flex-wrap mt-2 text-sm">
          <span className="mr-3 text-gray-600 dark:text-gray-400">
            🧩 {t("codeStructure.classes")}: {stats.byType.class}
          </span>
          <span className="mr-3 text-gray-600 dark:text-gray-400">
            🔌 {t("codeStructure.interfaces")}: {stats.byType.interface}
          </span>
          <span className="mr-3 text-gray-600 dark:text-gray-400">
            📦 {t("codeStructure.structs")}: {stats.byType.struct}
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            🔢 {t("codeStructure.enums")}: {stats.byType.enum}
          </span>
        </div>
      </div>

      <div
        className={`p-4 rounded-lg shadow ${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="text-lg font-semibold mb-1">
          {t("codeStructure.members")}
        </div>
        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
          {stats.membersTotal}
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("codeStructure.avgPerStructure")}: {stats.avgMembers}
        </div>
      </div>

      <div
        className={`p-4 rounded-lg shadow ${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="text-lg font-semibold mb-1">
          {t("codeStructure.methods")}
        </div>
        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
          {stats.methodsTotal}
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("codeStructure.avgPerStructure")}: {stats.avgMethods}
        </div>
      </div>

      <div
        className={`p-4 rounded-lg shadow ${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="text-lg font-semibold mb-1">
          {t("codeStructure.structureComposition")}
        </div>
        <div className="h-16 flex items-end">
          {stats.total > 0 && (
            <>
              <div
                className="bg-blue-500 h-full"
                style={{
                  width: `${(stats.byType.class / stats.total) * 100}%`,
                  minWidth: stats.byType.class ? "5%" : "0",
                }}
                title={`${t("codeStructure.classes")}: ${stats.byType.class}`}
              />
              <div
                className="bg-green-500 h-full"
                style={{
                  width: `${(stats.byType.interface / stats.total) * 100}%`,
                  minWidth: stats.byType.interface ? "5%" : "0",
                }}
                title={`${t("codeStructure.interfaces")}: ${
                  stats.byType.interface
                }`}
              />
              <div
                className="bg-yellow-500 h-full"
                style={{
                  width: `${(stats.byType.struct / stats.total) * 100}%`,
                  minWidth: stats.byType.struct ? "5%" : "0",
                }}
                title={`${t("codeStructure.structs")}: ${stats.byType.struct}`}
              />
              <div
                className="bg-purple-500 h-full"
                style={{
                  width: `${(stats.byType.enum / stats.total) * 100}%`,
                  minWidth: stats.byType.enum ? "5%" : "0",
                }}
                title={`${t("codeStructure.enums")}: ${stats.byType.enum}`}
              />
            </>
          )}
        </div>
        <div className="mt-2 text-xs flex justify-between text-gray-600 dark:text-gray-400">
          <span>🧩</span>
          <span>🔌</span>
          <span>📦</span>
          <span>🔢</span>
        </div>
      </div>
    </div>
  );
}
