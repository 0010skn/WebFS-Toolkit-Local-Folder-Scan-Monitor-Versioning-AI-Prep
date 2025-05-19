"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  directoryHandleAtom,
  dockerComposeFilesAtom,
  selectedDockerComposeAtom,
  dockerComposeContentAtom,
  parsedDockerComposeAtom,
  dockerComposeErrorsAtom,
} from "../lib/store";
import {
  detectDockerfile,
  readDockerCompose,
  parseDockerCompose,
  validateDockerCompose,
} from "../lib/dockerService";
import { DockerComposeService } from "../types";
import { useTranslations } from "./LocaleProvider";

export default function DockerComposeView() {
  const { t } = useTranslations();
  const [directoryHandle] = useAtom(directoryHandleAtom);
  const [dockerComposeFiles, setDockerComposeFiles] = useAtom(
    dockerComposeFilesAtom
  );
  const [selectedDockerCompose, setSelectedDockerCompose] = useAtom(
    selectedDockerComposeAtom
  );
  const [dockerComposeContent, setDockerComposeContent] = useAtom(
    dockerComposeContentAtom
  );
  const [parsedDockerCompose, setParsedDockerCompose] = useAtom(
    parsedDockerComposeAtom
  );
  const [dockerComposeErrors, setDockerComposeErrors] = useAtom(
    dockerComposeErrorsAtom
  );
  const [selectedService, setSelectedService] = useState<string>("");

  // 检测Docker Compose文件
  useEffect(() => {
    if (!directoryHandle) return;

    async function checkForDockerComposeFiles() {
      try {
        if (!directoryHandle) return;

        // 使用detectDockerfile来获取Docker Compose文件列表，因为它也检测docker-compose.yml
        const result = await detectDockerfile(directoryHandle);

        // 过滤只保留Docker Compose文件
        const composeFiles = {
          exists: false,
          paths: result.paths.filter(
            (path) =>
              path.includes("docker-compose.yml") ||
              path.includes("docker-compose.yaml")
          ),
        };

        composeFiles.exists = composeFiles.paths.length > 0;
        setDockerComposeFiles(composeFiles);

        // 如果找到Docker Compose文件并且之前没有选择过，自动选择第一个
        if (
          composeFiles.exists &&
          composeFiles.paths.length > 0 &&
          !selectedDockerCompose
        ) {
          setSelectedDockerCompose(composeFiles.paths[0]);
        }
      } catch (error) {
        console.error("检测Docker Compose文件时出错:", error);
      }
    }

    checkForDockerComposeFiles();
  }, [
    directoryHandle,
    setDockerComposeFiles,
    selectedDockerCompose,
    setSelectedDockerCompose,
  ]);

  // 加载选中的Docker Compose文件内容
  useEffect(() => {
    if (!directoryHandle || !selectedDockerCompose) return;

    async function loadDockerComposeContent() {
      try {
        if (!directoryHandle) return;

        const content = await readDockerCompose(
          directoryHandle,
          selectedDockerCompose
        );
        setDockerComposeContent(content);

        // 解析Docker Compose文件
        const dockerCompose = parseDockerCompose(content);
        setParsedDockerCompose(dockerCompose);

        // 验证Docker Compose文件
        const errors = validateDockerCompose(dockerCompose);
        setDockerComposeErrors(errors);

        // 如果有服务，默认选择第一个
        if (dockerCompose.services && dockerCompose.services.length > 0) {
          setSelectedService(dockerCompose.services[0].name);
        }
      } catch (error) {
        console.error(
          `读取Docker Compose文件 ${selectedDockerCompose} 时出错:`,
          error
        );
        setDockerComposeContent("");
        setParsedDockerCompose(null);
        setDockerComposeErrors([`无法读取Docker Compose文件: ${error}`]);
      }
    }

    loadDockerComposeContent();
  }, [
    directoryHandle,
    selectedDockerCompose,
    setDockerComposeContent,
    setParsedDockerCompose,
    setDockerComposeErrors,
  ]);

  // 处理Docker Compose文件选择变化
  const handleDockerComposeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedDockerCompose(e.target.value);
  };

  // 处理服务选择变化
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedService(e.target.value);
  };

  // 查找当前选中的服务
  const getSelectedService = (): DockerComposeService | null => {
    if (!parsedDockerCompose || !selectedService) return null;

    return (
      parsedDockerCompose.services.find(
        (service) => service.name === selectedService
      ) || null
    );
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

  if (!dockerComposeFiles.exists) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-center text-gray-500 dark:text-gray-400">
          {t("dockerCompose.noDockerCompose")}
        </p>
      </div>
    );
  }

  const selectedServiceData = getSelectedService();

  return (
    <div className="flex flex-col h-full">
      {/* 顶部选择器和工具栏 */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={selectedDockerCompose}
            onChange={handleDockerComposeChange}
            className="block w-64 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {dockerComposeFiles &&
              dockerComposeFiles.paths &&
              dockerComposeFiles.paths.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
          </select>

          {parsedDockerCompose && parsedDockerCompose.services.length > 0 && (
            <select
              value={selectedService}
              onChange={handleServiceChange}
              className="block w-48 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {parsedDockerCompose.services.map((service) => (
                <option key={service.name} value={service.name}>
                  {service.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 错误状态标签 */}
        {parsedDockerCompose && (
          <div
            className={`px-2 py-1 rounded-md text-sm ${
              parsedDockerCompose.hasError || dockerComposeErrors.length > 0
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            }`}
          >
            {parsedDockerCompose.hasError || dockerComposeErrors.length > 0
              ? t("dockerCompose.hasErrors")
              : t("dockerCompose.valid")}
          </div>
        )}
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-auto grid grid-cols-2 gap-4 p-4">
        {/* 左侧: Compose文件内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full">
          <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            {t("dockerCompose.content")}
          </h3>
          <pre className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-md text-sm font-mono">
            {dockerComposeContent || t("docker.loading")}
          </pre>
        </div>

        {/* 右侧: 服务详情 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full">
          <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            {t("dockerCompose.serviceDetails")}
          </h3>

          {parsedDockerCompose ? (
            <div className="flex-1 overflow-auto">
              {/* 版本信息 */}
              <div className="mb-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("dockerCompose.version")}:
                    </span>{" "}
                    <span className="font-medium">
                      {parsedDockerCompose.version}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("dockerCompose.serviceCount")}:
                    </span>{" "}
                    <span className="font-medium">
                      {parsedDockerCompose.services.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* 选中服务详情 */}
              {selectedServiceData ? (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">
                    {selectedServiceData.name}
                  </h4>

                  {/* 镜像或构建信息 */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {selectedServiceData.image ? (
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("dockerCompose.image")}:
                        </span>{" "}
                        <span className="font-medium">
                          {selectedServiceData.image}
                        </span>
                      </div>
                    ) : selectedServiceData.build ? (
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t("dockerCompose.build")}:
                        </span>{" "}
                        <span className="font-medium">
                          {typeof selectedServiceData.build === "string"
                            ? selectedServiceData.build
                            : selectedServiceData.build.context +
                              (selectedServiceData.build.dockerfile
                                ? ` (${selectedServiceData.build.dockerfile})`
                                : "")}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* 端口映射 */}
                  {selectedServiceData.ports &&
                    selectedServiceData.ports.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t("dockerCompose.ports")}
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                          <ul className="list-disc list-inside text-sm">
                            {selectedServiceData.ports.map((port, index) => (
                              <li
                                key={index}
                                className="text-gray-600 dark:text-gray-400"
                              >
                                {port}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                  {/* 环境变量 */}
                  {selectedServiceData.environment &&
                    Object.keys(selectedServiceData.environment).length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t("dockerCompose.environment")}
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                          <table className="min-w-full text-sm">
                            <tbody>
                              {Object.entries(
                                selectedServiceData.environment
                              ).map(([key, value], index) => (
                                <tr key={index}>
                                  <td className="pr-4 text-gray-600 dark:text-gray-400 font-medium">
                                    {key}
                                  </td>
                                  <td className="text-gray-500 dark:text-gray-400">
                                    {value || ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  {/* 环境变量文件 */}
                  {selectedServiceData.env_file &&
                    selectedServiceData.env_file.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t("dockerCompose.envFiles")}
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                          <ul className="list-disc list-inside text-sm">
                            {(Array.isArray(selectedServiceData.env_file)
                              ? selectedServiceData.env_file
                              : [selectedServiceData.env_file]
                            ).map((file, index) => (
                              <li
                                key={index}
                                className="text-gray-600 dark:text-gray-400"
                              >
                                {file}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                  {/* 依赖服务 */}
                  {selectedServiceData.depends_on &&
                    selectedServiceData.depends_on.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t("dockerCompose.dependsOn")}
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                          <ul className="list-disc list-inside text-sm">
                            {selectedServiceData.depends_on.map(
                              (dep, index) => (
                                <li
                                  key={index}
                                  className="text-gray-600 dark:text-gray-400"
                                >
                                  {dep}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                  {/* 卷映射 */}
                  {selectedServiceData.volumes &&
                    selectedServiceData.volumes.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t("dockerCompose.volumes")}
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                          <ul className="list-disc list-inside text-sm">
                            {selectedServiceData.volumes.map(
                              (volume, index) => (
                                <li
                                  key={index}
                                  className="text-gray-600 dark:text-gray-400"
                                >
                                  {volume}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    {t("dockerCompose.selectService")}
                  </p>
                </div>
              )}

              {/* 错误信息 */}
              {dockerComposeErrors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-medium mb-2 text-red-600 dark:text-red-400">
                    {t("docker.errors")}
                  </h4>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-sm">
                    <ul className="list-disc list-inside text-red-600 dark:text-red-400">
                      {dockerComposeErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t("docker.loadingAnalysis")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
