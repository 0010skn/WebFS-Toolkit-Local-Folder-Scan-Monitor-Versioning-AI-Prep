"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "./LocaleProvider";
import { useTheme } from "next-themes";
import {
  testWithAI,
  findRelevantFiles,
  parseFilePathsResult,
  getKnowledgeContent,
  chatCompletion,
  getLocalizedPrompt,
  modifyFile,
  deleteFile,
  createFile,
} from "../lib/vectorizeService";
import Markdown from "markdown-to-jsx";
import { useAtom } from "jotai";
import { currentScanAtom } from "../lib/store";
import { KnowledgeEntry } from "../lib/knowledgeService";
import { FileSystemEntry } from "../types";

// 步骤类型
enum StepType {
  READ_FILE = "read_file",
  WRITE_FILE = "write_file", 
  DELETE_FILE = "delete_file",
  CREATE_FILE = "create_file",
  ANALYZE = "analyze",
  COMPLETE = "complete"
}

// 执行步骤接口
interface ExecutionStep {
  id: string;
  type: StepType;
  description: string;
  filePath?: string;
  content?: string;
  startLine?: number;
  endLine?: number;
  status: "pending" | "executing" | "completed" | "failed";
  result?: string;
}

// 对话消息接口
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  stepId?: string;
  isDecision?: boolean; // 是否是决策消息
}

// 组件属性接口
interface AIagentProps {
  onClose: () => void;
  initialPrompt: string;
  projectFilePaths?: string[];
}

// 简单的代码块组件
const CodeBlock = ({
  className,
  children,
}: {
  className?: string;
  children: string;
}) => {
  const codeContent = typeof children === "string" ? children : String(children || "");
  
  // 从className中提取语言信息
  let language = className ? className.replace(/language-/, "") : "text";
  
  // 如果是内联代码
  if (!codeContent.includes("\n") && codeContent.trim().length < 80 && !className) {
    return (
      <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">
        {codeContent.trim()}
      </code>
    );
  }

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden my-2 w-full">
      <div className="bg-gray-200 dark:bg-gray-600 px-4 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 overflow-x-auto font-mono text-sm">
        <code>{codeContent}</code>
      </pre>
    </div>
  );
};

export default function AIagent({
  onClose,
  initialPrompt,
  projectFilePaths = [],
}: AIagentProps) {
  const t = useTranslations();
  const [currentScan] = useAtom(currentScanAtom);

  // 核心状态
  const [hasPermission, setHasPermission] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState<ExecutionStep | null>(null);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [waitingForDecision, setWaitingForDecision] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [userInput, setUserInput] = useState("");
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  // UI refs
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 生成唯一ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // 权限处理
  const handlePermissionRequest = () => {
    setHasPermission(true);
    initializeAgent();
  };

  // 初始化智能体
  const initializeAgent = async () => {
    if (isInitialized) return;
    
    setIsInitialized(true);
    
    // 添加系统消息
    const systemMessage: ChatMessage = {
      id: generateId(),
      role: "system",
      content: "智能体已启动，准备执行任务...",
      timestamp: new Date(),
    };
    
    setChatMessages([systemMessage]);
    
    // 开始第一轮对话
    await processUserInput(initialPrompt);
  };

  // 处理用户输入
  const processUserInput = async (input: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setCurrentResponse("");
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user", 
      content: input,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    
    // 执行AI处理
    await executeAIResponse(input);
  };

  // 执行AI响应（第一阶段：总结和计划）
  const executeAIResponse = async (input: string) => {
    try {
      // 构建系统提示
      const systemPrompt = getLocalizedPrompt(
        `你是一个智能代码助手，采用步骤式执行模式。你需要将任务分解为具体的步骤，每次只执行一个操作。

## 执行规则
1. **一次一步**: 每次回复只能描述一个具体的操作步骤
2. **操作类型**: 只能是以下类型之一
   - read_file: 读取文件内容
   - write_file: 修改文件内容  
   - create_file: 创建新文件
   - delete_file: 删除文件
   - analyze: 分析代码或思考
   - complete: 任务完成

## 回复格式
你的回复必须包含一个步骤描述块：

\`\`\`step
type: [操作类型]
description: [详细描述这一步要做什么]
file_path: [如果涉及文件操作，填写文件路径]
\`\`\`

然后用自然语言解释这一步的目的和预期结果。

## 示例
\`\`\`step
type: read_file
description: 读取 src/components/Button.tsx 文件，了解当前的按钮组件实现
file_path: src/components/Button.tsx
\`\`\`

我需要先查看当前的按钮组件代码，了解它的结构和样式，然后才能进行修改。`,
        
        `You are an intelligent code assistant using step-by-step execution mode. You need to break down tasks into specific steps, executing only one operation at a time.

## Execution Rules
1. **One step at a time**: Each reply can only describe one specific operation step
2. **Operation types**: Must be one of the following types
   - read_file: Read file content
   - write_file: Modify file content
   - create_file: Create new file
   - delete_file: Delete file
   - analyze: Analyze code or think
   - complete: Task completed

## Reply Format
Your reply must include a step description block:

\`\`\`step
type: [operation_type]
description: [detailed description of what this step does]
file_path: [if file operation involved, provide file path]
\`\`\`

Then explain the purpose and expected result of this step in natural language.

## Example
\`\`\`step
type: read_file
description: Read src/components/Button.tsx file to understand current button component implementation
file_path: src/components/Button.tsx
\`\`\`

I need to first examine the current button component code to understand its structure and styling before making modifications.`
      );

      // 构建对话历史
      const history = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: input }
      ];

      let response = "";
      
      // 流式获取AI响应
      await chatCompletion(history, {
        model: "gpt-4o",
        stream: true,
        onUpdate: (chunk) => {
          response += chunk;
          setCurrentResponse(response);
        },
      });

      // 解析步骤信息
      const step = parseStepFromResponse(response);
      
      if (step) {
        // 添加步骤到执行列表
        setExecutionSteps(prev => [...prev, step]);
        setCurrentStep(step);
        
        // 添加AI消息
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
          stepId: step.id,
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
        setConversationHistory(prev => [...prev, { role: "user", content: input }, { role: "assistant", content: response }]);
        
        // 执行步骤
        await executeStep(step);
      } else {
        // 如果没有解析到步骤，可能是任务完成或需要更多信息
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
        setConversationHistory(prev => [...prev, { role: "user", content: input }, { role: "assistant", content: response }]);
      }
      
    } catch (error) {
      console.error("AI响应错误:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 从AI响应中解析步骤信息
  const parseStepFromResponse = (response: string): ExecutionStep | null => {
    const stepMatch = response.match(/```step\s*([\s\S]*?)\s*```/);
    if (!stepMatch) return null;
    
    const stepContent = stepMatch[1];
    const lines = stepContent.split('\n').map(line => line.trim()).filter(line => line);
    
    const stepData: any = {};
    lines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        stepData[key.trim()] = valueParts.join(':').trim();
      }
    });
    
    if (!stepData.type || !stepData.description) return null;
    
    return {
      id: generateId(),
      type: stepData.type as StepType,
      description: stepData.description,
      filePath: stepData.file_path,
      content: stepData.content,
      startLine: stepData.start_line ? parseInt(stepData.start_line) : undefined,
      endLine: stepData.end_line ? parseInt(stepData.end_line) : undefined,
      status: "pending",
    };
  };

  // 执行具体步骤
  const executeStep = async (step: ExecutionStep) => {
    setCurrentStep({ ...step, status: "executing" });
    
    try {
      let result = "";
      
      switch (step.type) {
        case StepType.READ_FILE:
          result = await executeReadFile(step);
          break;
        case StepType.WRITE_FILE:
          result = await executeWriteFile(step);
          break;
        case StepType.CREATE_FILE:
          result = await executeCreateFile(step);
          break;
        case StepType.DELETE_FILE:
          result = await executeDeleteFile(step);
          break;
        case StepType.ANALYZE:
          result = "分析完成";
          break;
        case StepType.COMPLETE:
          result = "任务完成";
          break;
        default:
          result = "未知操作类型";
      }
      
      // 更新步骤状态
      const completedStep = { ...step, status: "completed" as const, result };
      setCurrentStep(completedStep);
      setExecutionSteps(prev => prev.map(s => s.id === step.id ? completedStep : s));
      
      // 等待用户决定是否继续
      await askForContinuation(completedStep);
      
    } catch (error) {
      console.error("步骤执行错误:", error);
      const failedStep = { ...step, status: "failed" as const, result: `执行失败: ${error}` };
      setCurrentStep(failedStep);
      setExecutionSteps(prev => prev.map(s => s.id === step.id ? failedStep : s));
    }
  };

  // 执行读取文件
  const executeReadFile = async (step: ExecutionStep): Promise<string> => {
    if (!step.filePath) throw new Error("文件路径未指定");
    
    const entry = currentScan?.entries.find(
      (e) => e.path === step.filePath && e.type === "file"
    );
    
    if (!entry || !entry.content) {
      throw new Error(`文件不存在或无内容: ${step.filePath}`);
    }
    
    return `已读取文件 ${step.filePath}，内容长度: ${entry.content.length} 字符`;
  };

  // 执行写入文件
  const executeWriteFile = async (step: ExecutionStep): Promise<string> => {
    if (!step.filePath || !step.content) {
      throw new Error("文件路径或内容未指定");
    }
    
    await modifyFile(step.filePath, step.content, step.startLine, step.endLine);
    return `已修改文件 ${step.filePath}`;
  };

  // 执行创建文件
  const executeCreateFile = async (step: ExecutionStep): Promise<string> => {
    if (!step.filePath || !step.content) {
      throw new Error("文件路径或内容未指定");
    }
    
    await createFile(step.filePath, step.content);
    return `已创建文件 ${step.filePath}`;
  };

  // 执行删除文件
  const executeDeleteFile = async (step: ExecutionStep): Promise<string> => {
    if (!step.filePath) throw new Error("文件路径未指定");
    
    await deleteFile(step.filePath);
    return `已删除文件 ${step.filePath}`;
  };

  // 询问是否继续
  const askForContinuation = async (completedStep: ExecutionStep) => {
    setWaitingForDecision(true);
    
    // 第一阶段：总结当前步骤结果
    const summaryPrompt = `刚才执行了以下步骤：
类型: ${completedStep.type}
描述: ${completedStep.description}
结果: ${completedStep.result}

请总结这一步的结果，并说明下一步的计划。`;

    let summaryResponse = "";
    
    await chatCompletion([
      ...conversationHistory,
      { role: "user", content: summaryPrompt }
    ], {
      model: "gpt-4o",
      stream: true,
      onUpdate: (chunk) => {
        summaryResponse += chunk;
        setCurrentResponse(summaryResponse);
      },
    });

    // 添加总结消息
    const summaryMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: summaryResponse,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, summaryMessage]);
    setConversationHistory(prev => [...prev, { role: "user", content: summaryPrompt }, { role: "assistant", content: summaryResponse }]);

    // 第二阶段：决策是否继续
    const decisionPrompt = `基于当前任务进度，你认为是否需要继续执行下一步？请回答 "continue" 或 "stop"，并简要说明原因。`;
    
    let decisionResponse = "";
    
    await chatCompletion([
      ...conversationHistory,
      { role: "user", content: decisionPrompt }
    ], {
      model: "gpt-4o",
      stream: true,
      onUpdate: (chunk) => {
        decisionResponse += chunk;
        setCurrentResponse(decisionResponse);
      },
    });

    // 添加决策消息
    const decisionMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: decisionResponse,
      timestamp: new Date(),
      isDecision: true,
    };
    
    setChatMessages(prev => [...prev, decisionMessage]);
    setConversationHistory(prev => [...prev, { role: "user", content: decisionPrompt }, { role: "assistant", content: decisionResponse }]);

    // 解析决策结果
    const shouldContinue = decisionResponse.toLowerCase().includes("continue");
    
    if (shouldContinue && completedStep.type !== StepType.COMPLETE) {
      // 继续下一步
      setTimeout(() => {
        setWaitingForDecision(false);
        processUserInput("继续执行下一步");
      }, 1000);
    } else {
      // 停止执行
      setWaitingForDecision(false);
      setIsProcessing(false);
    }
  };

  // 处理用户提交
  const handleSubmit = async () => {
    if (!userInput.trim() || isProcessing) return;
    
    const input = userInput.trim();
    setUserInput("");
    
    await processUserInput(input);
  };

  // 处理键盘事件
  const handleKeyDown = (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 渲染权限请求UI
  const renderPermissionRequest = () => {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md mx-auto">
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-yellow-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          智能体权限请求
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
          智能体需要权限来修改你的代码文件。请确认是否授权。
        </p>
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handlePermissionRequest}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            授权
          </button>
        </div>
      </div>
    );
  };

  // 渲染步骤列表
  const renderStepsList = () => {
    if (executionSteps.length === 0) return null;

    return (
      <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          执行步骤 ({executionSteps.length})
        </h3>
        <div className="space-y-2">
          {executionSteps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center p-2 rounded-md ${
                step.status === "completed"
                  ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : step.status === "executing"
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : step.status === "failed"
                  ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="flex-shrink-0 mr-3">
                {step.status === "completed" ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : step.status === "executing" ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : step.status === "failed" ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-current" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium">{step.type}</div>
                <div className="text-sm">{step.description}</div>
                {step.filePath && (
                  <div className="text-xs opacity-75">{step.filePath}</div>
                )}
                {step.result && (
                  <div className="text-xs mt-1 opacity-75">{step.result}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染聊天消息
  const renderChatMessages = () => {
    return (
      <div className="space-y-4">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-3xl rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : message.role === "system"
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-center"
                  : message.isDecision
                  ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              }`}
            >
              {message.role === "user" ? (
                <div>{message.content}</div>
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <Markdown
                    options={{
                      overrides: {
                        code: {
                          component: CodeBlock,
                        },
                      },
                    }}
                  >
                    {message.content}
                  </Markdown>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* 当前响应 */}
        {isProcessing && currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-3xl rounded-lg p-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
              <div className="prose dark:prose-invert max-w-none">
                <Markdown
                  options={{
                    overrides: {
                      code: {
                        component: CodeBlock,
                      },
                    },
                  }}
                >
                  {currentResponse}
                </Markdown>
              </div>
              <div className="flex items-center mt-2 text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                思考中...
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 主渲染
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              智能代码助手 - 步骤式执行
            </h2>
          </div>
          
          {/* 状态指示器 */}
          <div className="flex items-center space-x-4">
            {hasPermission && (
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isProcessing
                      ? "bg-blue-500 animate-pulse"
                      : waitingForDecision
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-green-500"
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isProcessing
                    ? "处理中"
                    : waitingForDecision
                    ? "等待决策"
                    : "就绪"}
                </span>
              </div>
            )}
            
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-4"
          style={{ scrollBehavior: "smooth" }}
        >
          {!hasPermission ? (
            renderPermissionRequest()
          ) : (
            <div>
              {renderStepsList()}
              {renderChatMessages()}
            </div>
          )}
        </div>

        {/* 输入框区域 */}
        {hasPermission && !waitingForDecision && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的指令..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                rows={3}
                disabled={isProcessing}
              />
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !userInput.trim()}
                className={`absolute right-3 bottom-3 p-2 rounded-full ${
                  isProcessing || !userInput.trim()
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                } transition-colors`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
