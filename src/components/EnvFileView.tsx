"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  envFilesAtom,
  selectedEnvFileAtom,
  envFileContentAtom,
  parsedEnvFileAtom,
  envFileErrorsAtom,
} from "../lib/store";
import {
  detectEnvFiles,
  readEnvFile,
  parseEnvFile,
  validateEnvFile,
  fixEnvFile,
} from "../lib/dockerService";
import { EnvVariable } from "../types";
import { useTranslations } from "./LocaleProvider";

export default function EnvFileView() {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [envFiles, setEnvFiles] = useAtom(envFilesAtom);
  const [selectedEnvFile, setSelectedEnvFile] = useAtom(selectedEnvFileAtom);
  const [envFileContent, setEnvFileContent] = useAtom(envFileContentAtom);
  const [parsedEnvFile, setParsedEnvFile] = useAtom(parsedEnvFileAtom);
  const [envFileErrors, setEnvFileErrors] = useAtom(envFileErrorsAtom);
  const [isFixing, setIsFixing] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  // 检测环境变量文件
  useEffect(() => {
    if (!directoryHandle) return;

    async function checkForEnvFiles() {
      try {
        if (!directoryHandle) return;

        const result = await detectEnvFiles(directoryHandle);
        setEnvFiles(result);

        // 如果找到环境变量文件并且之前没有选择过，自动选择第一个
        if (result.exists && result.paths.length > 0 && !selectedEnvFile) {
          setSelectedEnvFile(result.paths[0]);
        }
      } catch (error) {
        console.error("检测环境变量文件时出错:", error);
      }
    }

    checkForEnvFiles();
  }, [directoryHandle, setEnvFiles, selectedEnvFile, setSelectedEnvFile]);

  // 加载选中的环境变量文件内容
  useEffect(() => {
    if (!directoryHandle || !selectedEnvFile) return;

    async function loadEnvFileContent() {
      try {
        if (!directoryHandle) return;

        const content = await readEnvFile(directoryHandle, selectedEnvFile);
        setEnvFileContent(content);

        // 解析环境变量文件
        const envFile = parseEnvFile(content, selectedEnvFile);
        setParsedEnvFile(envFile);

        // 验证环境变量文件
        const errors = validateEnvFile(envFile);
        setEnvFileErrors(errors);
      } catch (error) {
        console.error(`读取环境变量文件 ${selectedEnvFile} 时出错:`, error);
        setEnvFileContent("");
        setParsedEnvFile(null);
        setEnvFileErrors([`无法读取环境变量文件: ${error}`]);
      }
    }

    loadEnvFileContent();
  }, [
    directoryHandle,
    selectedEnvFile,
    setEnvFileContent,
    setParsedEnvFile,
    setEnvFileErrors,
  ]);

  // 修复环境变量文件
  const handleFixEnvFile = async () => {
    if (!envFileContent) return;

    setIsFixing(true);
    try {
      // 修复环境变量文件内容
      const fixedContent = fixEnvFile(envFileContent);
      setEnvFileContent(fixedContent);

      // 重新解析和验证
      const envFile = parseEnvFile(fixedContent, selectedEnvFile);
      setParsedEnvFile(envFile);
      const errors = validateEnvFile(envFile);
      setEnvFileErrors(errors);
    } catch (error) {
      console.error("修复环境变量文件时出错:", error);
    } finally {
      setIsFixing(false);
    }
  };

  // 处理环境变量文件选择变化
  const handleEnvFileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEnvFile(e.target.value);
  };

  // 处理显示/隐藏敏感信息
  const toggleShowSensitive = () => {
    setShowSensitive(!showSensitive);
  };

  // 渲染变量值
  const renderVariableValue = (variable: EnvVariable) => {
    if (variable.isComment) return variable.value;
    if (variable.isSensitive && !showSensitive) return "********";
    return variable.value;
  };

  if (!directoryHandle) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-center text-gray-500 dark:text-gray-400">
          {t("envFile.selectProject")}
        </p>
      </div>
    );
  }

  if (!envFiles.exists) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-center text-gray-500 dark:text-gray-400">
          {t("envFile.noEnvFile")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部选择器和工具栏 */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={selectedEnvFile}
            onChange={handleEnvFileChange}
            className="block w-64 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {envFiles &&
              envFiles.paths &&
              envFiles.paths.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
          </select>

          <button
            onClick={handleFixEnvFile}
            disabled={isFixing || !envFileContent}
            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFixing ? t("envFile.fixing") : t("envFile.fix")}
          </button>

          <button
            onClick={toggleShowSensitive}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {showSensitive
              ? t("envFile.hideSensitive")
              : t("envFile.showSensitive")}
          </button>
        </div>

        {/* 错误状态标签 */}
        {parsedEnvFile && (
          <div
            className={`px-2 py-1 rounded-md text-sm ${
              parsedEnvFile.hasError || envFileErrors.length > 0
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            }`}
          >
            {parsedEnvFile.hasError || envFileErrors.length > 0
              ? t("envFile.hasErrors")
              : t("envFile.valid")}
          </div>
        )}
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-auto grid grid-cols-2 gap-4 p-4">
        {/* 左侧: 环境变量文件内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full">
          <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            {t("envFile.content")}
          </h3>
          <pre className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-md text-sm font-mono">
            {envFileContent || t("envFile.loading")}
          </pre>
        </div>

        {/* 右侧: 变量列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full">
          <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            {t("envFile.variables")}
          </h3>

          {parsedEnvFile?.variables && parsedEnvFile.variables.length > 0 ? (
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("envFile.line")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("envFile.key")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("envFile.value")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("envFile.type")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedEnvFile.variables.map((variable, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {variable.line}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {variable.isComment
                          ? t("envFile.comment")
                          : variable.key}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {renderVariableValue(variable)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            variable.isComment
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              : variable.isSensitive
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          }`}
                        >
                          {variable.isComment
                            ? t("envFile.commentType")
                            : variable.isSensitive
                            ? t("envFile.sensitiveType")
                            : t("envFile.normalType")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t("envFile.loading")}
              </p>
            </div>
          )}

          {/* 错误信息 */}
          {envFileErrors && envFileErrors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-medium mb-2 text-red-600 dark:text-red-400">
                {t("envFile.errors")}
              </h4>
              <ul className="bg-red-50 dark:bg-red-900/20 rounded-md p-3 text-sm text-red-800 dark:text-red-300">
                {envFileErrors.map((error, index) => (
                  <li key={index} className="list-disc ml-4 mb-1">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
