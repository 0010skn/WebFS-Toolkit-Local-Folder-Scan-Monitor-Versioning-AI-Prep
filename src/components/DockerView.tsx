"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  dockerfilesAtom,
  selectedDockerfileAtom,
  dockerfileContentAtom,
  parsedDockerfileAtom,
  dockerfileErrorsAtom,
} from "../lib/store";
import {
  detectDockerfile,
  readDockerfile,
  parseDockerfile,
  validateDockerfile,
  fixDockerfile,
} from "../lib/dockerService";
import { Dockerfile } from "../types";
import { useTranslations } from "./LocaleProvider";

export default function DockerView() {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [dockerfiles, setDockerfiles] = useAtom(dockerfilesAtom);
  const [selectedDockerfile, setSelectedDockerfile] = useAtom(
    selectedDockerfileAtom
  );
  const [dockerfileContent, setDockerfileContent] = useAtom(
    dockerfileContentAtom
  );
  const [parsedDockerfile, setParsedDockerfile] = useAtom(parsedDockerfileAtom);
  const [dockerfileErrors, setDockerfileErrors] = useAtom(dockerfileErrorsAtom);
  const [isFixing, setIsFixing] = useState(false);

  // 检测Dockerfile
  useEffect(() => {
    if (!directoryHandle) return;

    async function checkForDockerfiles() {
      try {
        if (!directoryHandle) return;

        const result = await detectDockerfile(directoryHandle);
        setDockerfiles(result);

        // 如果找到Dockerfile并且之前没有选择过，自动选择第一个
        if (result.exists && result.paths.length > 0 && !selectedDockerfile) {
          setSelectedDockerfile(result.paths[0]);
        }
      } catch (error) {
        console.error("检测Dockerfile时出错:", error);
      }
    }

    checkForDockerfiles();
  }, [
    directoryHandle,
    setDockerfiles,
    selectedDockerfile,
    setSelectedDockerfile,
  ]);

  // 加载选中的Dockerfile内容
  useEffect(() => {
    if (!directoryHandle || !selectedDockerfile) return;

    async function loadDockerfileContent() {
      try {
        if (!directoryHandle) return;

        const content = await readDockerfile(
          directoryHandle,
          selectedDockerfile
        );
        setDockerfileContent(content);

        // 解析Dockerfile
        const dockerfile = parseDockerfile(content);
        setParsedDockerfile(dockerfile);

        // 验证Dockerfile
        const errors = validateDockerfile(dockerfile);
        setDockerfileErrors(errors);
      } catch (error) {
        console.error(`读取Dockerfile ${selectedDockerfile} 时出错:`, error);
        setDockerfileContent("");
        setParsedDockerfile(null);
        setDockerfileErrors([`无法读取Dockerfile: ${error}`]);
      }
    }

    loadDockerfileContent();
  }, [
    directoryHandle,
    selectedDockerfile,
    setDockerfileContent,
    setParsedDockerfile,
    setDockerfileErrors,
  ]);

  // 修复Dockerfile
  const handleFixDockerfile = async () => {
    if (!dockerfileContent) return;

    setIsFixing(true);
    try {
      // 修复Dockerfile内容
      const fixedContent = fixDockerfile(dockerfileContent);
      setDockerfileContent(fixedContent);

      // 重新解析和验证
      const dockerfile = parseDockerfile(fixedContent);
      setParsedDockerfile(dockerfile);
      const errors = validateDockerfile(dockerfile);
      setDockerfileErrors(errors);
    } catch (error) {
      console.error("修复Dockerfile时出错:", error);
    } finally {
      setIsFixing(false);
    }
  };

  // 处理Dockerfile选择变化
  const handleDockerfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDockerfile(e.target.value);
  };

  if (!directoryHandle) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-center text-gray-500 dark:text-gray-400">
          {t("docker.selectProject")}
        </p>
      </div>
    );
  }

  if (!dockerfiles.exists) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-center text-gray-500 dark:text-gray-400">
          {t("docker.noDockerfile")}
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
            value={selectedDockerfile}
            onChange={handleDockerfileChange}
            className="block w-64 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {dockerfiles.paths.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>

          <button
            onClick={handleFixDockerfile}
            disabled={isFixing || !dockerfileContent}
            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFixing ? t("docker.fixing") : t("docker.fix")}
          </button>
        </div>

        {/* 错误状态标签 */}
        {parsedDockerfile && (
          <div
            className={`px-2 py-1 rounded-md text-sm ${
              parsedDockerfile.hasError || dockerfileErrors.length > 0
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            }`}
          >
            {parsedDockerfile.hasError || dockerfileErrors.length > 0
              ? t("docker.hasErrors")
              : t("docker.valid")}
          </div>
        )}
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-auto grid grid-cols-2 gap-4 p-4">
        {/* 左侧: Dockerfile内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full">
          <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            {t("docker.content")}
          </h3>
          <pre className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-md text-sm font-mono">
            {dockerfileContent || t("docker.loading")}
          </pre>
        </div>

        {/* 右侧: 可视化和错误 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full">
          <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            {t("docker.analysis")}
          </h3>

          {parsedDockerfile ? (
            <div className="flex-1 overflow-auto">
              {/* 基本信息 */}
              <div className="mb-4">
                <h4 className="text-md font-medium mb-2 text-gray-800 dark:text-gray-200">
                  {t("docker.baseInfo")}
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("docker.baseImage")}:
                      </span>{" "}
                      <span className="font-medium">
                        {parsedDockerfile.baseImage}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("docker.stages")}:
                      </span>{" "}
                      <span className="font-medium">
                        {parsedDockerfile.stages.length}
                      </span>
                    </div>
                    {parsedDockerfile.workdir && (
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("docker.workdir")}:
                        </span>{" "}
                        <span className="font-medium">
                          {parsedDockerfile.workdir}
                        </span>
                      </div>
                    )}
                    {parsedDockerfile.exposedPorts.length > 0 && (
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("docker.ports")}:
                        </span>{" "}
                        <span className="font-medium">
                          {parsedDockerfile.exposedPorts
                            .map((p) => `${p.number}/${p.protocol}`)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {parsedDockerfile.cmd && (
                      <div className="text-sm col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("docker.cmd")}:
                        </span>{" "}
                        <span className="font-medium">
                          {parsedDockerfile.cmd}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 环境变量 */}
              {Object.keys(parsedDockerfile.env).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-md font-medium mb-2 text-gray-800 dark:text-gray-200">
                    {t("docker.environment")}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(parsedDockerfile.env).map(
                        ([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {key}:
                            </span>{" "}
                            <span>{value}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {(parsedDockerfile.hasError || dockerfileErrors.length > 0) && (
                <div className="mb-4">
                  <h4 className="text-md font-medium mb-2 text-red-600 dark:text-red-400">
                    {t("docker.errors")}
                  </h4>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
                      {[...parsedDockerfile.errors, ...dockerfileErrors].map(
                        (error, index) => (
                          <li key={index}>{error}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* 构建阶段 */}
              {parsedDockerfile.stages.length > 1 && (
                <div className="mb-4">
                  <h4 className="text-md font-medium mb-2 text-gray-800 dark:text-gray-200">
                    {t("docker.buildStages")}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {parsedDockerfile.stages.map((stage, index) => (
                      <div
                        key={index}
                        className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
                      >
                        <div className="font-medium text-blue-600 dark:text-blue-400">
                          {stage.name} ({stage.baseImage})
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {t("docker.instructions")}:{" "}
                          {stage.instructions.length}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">
                {t("docker.loadingAnalysis")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
