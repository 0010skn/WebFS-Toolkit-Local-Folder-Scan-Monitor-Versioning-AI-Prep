import {
  Dockerfile,
  Stage,
  Port,
  EnvFile,
  EnvVariable,
  DockerComposeConfig,
  DockerComposeService,
} from "../types";
import * as yaml from "js-yaml";

/**
 * 检测项目中是否存在Dockerfile
 * @param rootHandle 项目根目录句柄
 * @returns 是否存在Dockerfile
 */
export async function detectDockerfile(
  rootHandle: FileSystemDirectoryHandle
): Promise<{ exists: boolean; paths: string[] }> {
  try {
    const dockerfilePaths: string[] = [];

    // 检查根目录下的标准Dockerfile
    try {
      await rootHandle.getFileHandle("Dockerfile", { create: false });
      dockerfilePaths.push("Dockerfile");
    } catch (error) {
      // 文件不存在，继续检查
      console.log("未找到根目录下的Dockerfile");
    }

    // 检查根目录下的docker-compose.yml
    try {
      await rootHandle.getFileHandle("docker-compose.yml", { create: false });
      dockerfilePaths.push("docker-compose.yml");
    } catch (error) {
      // 文件不存在，继续检查
      console.log("未找到根目录下的docker-compose.yml");
    }

    // 检查根目录下的docker-compose.yaml
    try {
      await rootHandle.getFileHandle("docker-compose.yaml", { create: false });
      dockerfilePaths.push("docker-compose.yaml");
    } catch (error) {
      // 文件不存在，继续检查
      console.log("未找到根目录下的docker-compose.yaml");
    }

    // 检查.docker目录
    try {
      const dockerDir = await rootHandle.getDirectoryHandle(".docker", {
        create: false,
      });
      for await (const [name, handle] of dockerDir.entries()) {
        if (
          handle.kind === "file" &&
          (name === "Dockerfile" ||
            name.endsWith(".dockerfile") ||
            name.endsWith(".Dockerfile") ||
            name === "docker-compose.yml" ||
            name === "docker-compose.yaml")
        ) {
          dockerfilePaths.push(`.docker/${name}`);
        }
      }
    } catch (error) {
      // 目录不存在，继续检查
      console.log("未找到.docker目录");
    }

    // 检查docker目录
    try {
      const dockerDir = await rootHandle.getDirectoryHandle("docker", {
        create: false,
      });
      for await (const [name, handle] of dockerDir.entries()) {
        if (
          handle.kind === "file" &&
          (name === "Dockerfile" ||
            name.endsWith(".dockerfile") ||
            name.endsWith(".Dockerfile") ||
            name === "docker-compose.yml" ||
            name === "docker-compose.yaml")
        ) {
          dockerfilePaths.push(`docker/${name}`);
        }
      }
    } catch (error) {
      // 目录不存在，继续检查
      console.log("未找到docker目录");
    }

    return {
      exists: dockerfilePaths.length > 0,
      paths: dockerfilePaths,
    };
  } catch (error) {
    console.error("检测Dockerfile时出错:", error);
    return { exists: false, paths: [] };
  }
}

/**
 * 读取Dockerfile内容
 * @param rootHandle 项目根目录句柄
 * @param filePath Dockerfile路径
 * @returns Dockerfile内容
 */
export async function readDockerfile(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<string> {
  try {
    const pathParts = filePath.split("/");
    const fileName = pathParts.pop()!;
    let currentHandle = rootHandle;

    // 导航到文件所在目录
    for (const part of pathParts) {
      if (!part) continue; // 跳过空部分
      currentHandle = await currentHandle.getDirectoryHandle(part, {
        create: false,
      });
    }

    // 获取文件
    const fileHandle = await currentHandle.getFileHandle(fileName, {
      create: false,
    });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (error) {
    console.error(`读取Dockerfile ${filePath} 时出错:`, error);
    throw error;
  }
}

/**
 * 解析Dockerfile内容
 * @param content Dockerfile内容
 * @returns 解析后的Dockerfile结构
 */
export function parseDockerfile(content: string): Dockerfile {
  const lines = content.split("\n");
  const dockerfile: Dockerfile = {
    baseImage: "",
    stages: [],
    workdir: "",
    exposedPorts: [],
    entrypoint: "",
    cmd: "",
    env: {},
    labels: {},
    hasError: false,
    errors: [],
    content: content,
  };

  let currentStage: Stage | null = null;
  let lineNumber = 0;
  let multilineInstruction = "";
  let isMultiline = false;

  for (let line of lines) {
    lineNumber++;
    line = line.trim();

    // 跳过空行和注释行
    if (!line || line.startsWith("#")) continue;

    // 处理多行指令
    if (isMultiline) {
      multilineInstruction += " " + line;
      if (!line.endsWith("\\")) {
        // 多行指令结束
        line = multilineInstruction;
        isMultiline = false;
        multilineInstruction = "";
      } else {
        continue;
      }
    } else if (line.endsWith("\\")) {
      // 开始多行指令
      isMultiline = true;
      multilineInstruction = line.slice(0, -1); // 移除尾部的 '\'
      continue;
    }

    // 解析指令
    try {
      const parts = line.split(/\s+/);
      const instruction = parts[0].toUpperCase();
      const args = parts.slice(1).join(" ");

      switch (instruction) {
        case "FROM":
          // 处理多阶段构建
          const fromParts = args.split(/\s+as\s+/i);
          const baseImage = fromParts[0].trim();
          const stageName =
            fromParts.length > 1
              ? fromParts[1].trim()
              : `stage${dockerfile.stages.length}`;

          currentStage = {
            name: stageName,
            baseImage: baseImage,
            instructions: [],
          };

          dockerfile.stages.push(currentStage);
          if (dockerfile.stages.length === 1) {
            dockerfile.baseImage = baseImage;
          }
          break;

        case "WORKDIR":
          if (currentStage) {
            currentStage.instructions.push({ type: "WORKDIR", value: args });
          }
          dockerfile.workdir = args;
          break;

        case "EXPOSE":
          const ports = args.split(/\s+/).map((port) => {
            const portInfo: Port = { number: 0, protocol: "tcp" };
            const portParts = port.split("/");
            portInfo.number = parseInt(portParts[0], 10);
            if (portParts.length > 1) {
              const protocol = portParts[1].toLowerCase();
              // 确保协议只能是 tcp 或 udp
              portInfo.protocol = protocol === "udp" ? "udp" : "tcp";
            }
            return portInfo;
          });

          dockerfile.exposedPorts.push(...ports);
          if (currentStage) {
            currentStage.instructions.push({ type: "EXPOSE", value: args });
          }
          break;

        case "ENV":
          const envPair = args.split(/=|\s+/);
          if (envPair.length >= 2) {
            const key = envPair[0];
            const value = envPair.slice(1).join(" ");
            dockerfile.env[key] = value;
            if (currentStage) {
              currentStage.instructions.push({ type: "ENV", value: args });
            }
          } else {
            dockerfile.hasError = true;
            dockerfile.errors.push(
              `Line ${lineNumber}: Invalid ENV instruction`
            );
          }
          break;

        case "LABEL":
          const labelParts = args.match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g);
          if (labelParts) {
            for (let i = 0; i < labelParts.length; i += 2) {
              if (i + 1 < labelParts.length) {
                let key = labelParts[i].replace(/^"(.*)"$/, "$1");
                let value = labelParts[i + 1].replace(/^"(.*)"$/, "$1");
                if (value.includes("=")) {
                  // 处理形如 LABEL key1=value1 key2=value2 的格式
                  const pair = key.split("=");
                  key = pair[0];
                  value = pair[1];
                  i--; // 调整索引，因为我们处理了一个而不是两个元素
                }
                dockerfile.labels[key] = value;
              }
            }
          }
          if (currentStage) {
            currentStage.instructions.push({ type: "LABEL", value: args });
          }
          break;

        case "ENTRYPOINT":
          dockerfile.entrypoint = args.replace(/[\[\]"]/g, "");
          if (currentStage) {
            currentStage.instructions.push({ type: "ENTRYPOINT", value: args });
          }
          break;

        case "CMD":
          dockerfile.cmd = args.replace(/[\[\]"]/g, "");
          if (currentStage) {
            currentStage.instructions.push({ type: "CMD", value: args });
          }
          break;

        default:
          if (currentStage) {
            currentStage.instructions.push({ type: instruction, value: args });
          }
          break;
      }
    } catch (error) {
      dockerfile.hasError = true;
      dockerfile.errors.push(`Line ${lineNumber}: ${error}`);
    }
  }

  if (dockerfile.stages.length === 0) {
    dockerfile.hasError = true;
    dockerfile.errors.push("No FROM instruction found in Dockerfile");
  }

  return dockerfile;
}

/**
 * 检查Dockerfile语法错误
 * @param dockerfile 解析后的Dockerfile结构
 * @returns 错误信息数组
 */
export function validateDockerfile(dockerfile: Dockerfile): string[] {
  const errors: string[] = [...dockerfile.errors];

  // 检查基础镜像
  if (!dockerfile.baseImage) {
    errors.push("Missing base image in FROM instruction");
  }

  // 检查端口格式
  for (const port of dockerfile.exposedPorts) {
    if (isNaN(port.number) || port.number <= 0 || port.number > 65535) {
      errors.push(`Invalid port number: ${port.number}`);
    }
    if (port.protocol !== "tcp" && port.protocol !== "udp") {
      errors.push(`Invalid port protocol: ${port.protocol}`);
    }
  }

  return errors;
}

/**
 * 修复Dockerfile中的常见问题
 * @param content Dockerfile内容
 * @returns 修复后的Dockerfile内容
 */
export function fixDockerfile(content: string): string {
  let fixedContent = content;

  // 修复行尾空格
  fixedContent = fixedContent.replace(/[ \t]+$/gm, "");

  // 修复多个空行变成一个空行
  fixedContent = fixedContent.replace(/\n{3,}/g, "\n\n");

  // 修复APT缓存问题
  fixedContent = fixedContent.replace(
    /RUN apt-get update && apt-get install -y/g,
    "RUN apt-get update && apt-get install -y"
  );

  // 如果没有清理APT缓存，添加清理命令
  if (
    fixedContent.includes("apt-get install") &&
    !fixedContent.includes("apt-get clean") &&
    !fixedContent.includes("rm -rf /var/lib/apt/lists/*")
  ) {
    fixedContent = fixedContent.replace(
      /(RUN apt-get update && apt-get install .+?)(\n|$)/,
      "$1 && apt-get clean && rm -rf /var/lib/apt/lists/*$2"
    );
  }

  return fixedContent;
}

/**
 * 检测项目中是否存在环境变量文件(.env)
 * @param rootHandle 项目根目录句柄
 * @returns 是否存在环境变量文件
 */
export async function detectEnvFiles(
  rootHandle: FileSystemDirectoryHandle
): Promise<{ exists: boolean; paths: string[] }> {
  try {
    const envFilePaths: string[] = [];

    // 环境变量文件名模式
    const envFilePatterns = [
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",
      ".env.test",
      ".env.example",
      ".env.sample",
      ".env.template",
      ".env.defaults",
      ".env.dev",
      ".env.prod",
      ".env.staging",
    ];

    // 检查根目录下的环境变量文件
    for (const pattern of envFilePatterns) {
      try {
        await rootHandle.getFileHandle(pattern, { create: false });
        envFilePaths.push(pattern);
      } catch (error) {
        // 文件不存在，继续检查下一个
        // console.log(`未找到 ${pattern} 文件`);
      }
    }

    return {
      exists: envFilePaths.length > 0,
      paths: envFilePaths,
    };
  } catch (error) {
    console.error("检测环境变量文件时出错:", error);
    return { exists: false, paths: [] };
  }
}

/**
 * 读取环境变量文件内容
 * @param rootHandle 项目根目录句柄
 * @param filePath 文件路径
 * @returns 环境变量文件内容
 */
export async function readEnvFile(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<string> {
  try {
    const pathParts = filePath.split("/");
    const fileName = pathParts.pop()!;
    let currentHandle = rootHandle;

    // 导航到文件所在目录
    for (const part of pathParts) {
      if (!part) continue; // 跳过空部分
      currentHandle = await currentHandle.getDirectoryHandle(part, {
        create: false,
      });
    }

    // 获取文件
    const fileHandle = await currentHandle.getFileHandle(fileName, {
      create: false,
    });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (error) {
    console.error(`读取环境变量文件 ${filePath} 时出错:`, error);
    throw error;
  }
}

/**
 * 解析环境变量文件内容
 * @param content 环境变量文件内容
 * @param filePath 文件路径
 * @returns 解析后的环境变量文件结构
 */
export function parseEnvFile(content: string, filePath: string): EnvFile {
  const lines = content.split("\n");
  const fileName = filePath.split("/").pop() || filePath;

  const envFile: EnvFile = {
    path: filePath,
    name: fileName,
    variables: [],
    hasError: false,
    errors: [],
  };

  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // 跳过空行
    if (!trimmedLine) continue;

    // 判断是否是注释行
    const isComment =
      trimmedLine.startsWith("#") || trimmedLine.startsWith("//");

    if (isComment) {
      // 存储注释行
      envFile.variables.push({
        key: "",
        value: trimmedLine,
        description: trimmedLine,
        line: lineNumber,
        isComment: true,
        isSensitive: false,
      });
      continue;
    }

    // 解析环境变量
    try {
      // 支持多种格式: KEY=VALUE, KEY="VALUE", KEY='VALUE', 键值之间可以有空格
      const match = trimmedLine.match(/^([^=\s]+)\s*=\s*(['"]?)([^'"]*)\2/);

      if (match) {
        const key = match[1];
        const value = match[3];
        let description = "";

        // 查找行内注释
        const commentIndex = trimmedLine.indexOf(
          "#",
          trimmedLine.indexOf(value) + value.length
        );
        if (commentIndex !== -1) {
          description = trimmedLine.substring(commentIndex).trim();
        }

        // 检测敏感信息
        const isSensitive = isSensitiveVariable(key, value);

        envFile.variables.push({
          key,
          value,
          description,
          line: lineNumber,
          isComment: false,
          isSensitive,
        });
      } else if (trimmedLine.includes("=")) {
        // 格式不规范但包含等号的行，尝试简单解析
        const [key, ...valueParts] = trimmedLine.split("=");
        const value = valueParts.join("=");

        envFile.variables.push({
          key: key.trim(),
          value: value.trim(),
          line: lineNumber,
          isComment: false,
          isSensitive: isSensitiveVariable(key.trim(), value.trim()),
        });
      } else {
        // 格式无法解析的行，记录错误
        envFile.hasError = true;
        envFile.errors.push(`第 ${lineNumber} 行: 无法解析 "${trimmedLine}"`);
      }
    } catch (error) {
      console.error(`解析环境变量第 ${lineNumber} 行时出错:`, error);
      envFile.hasError = true;
      envFile.errors.push(`第 ${lineNumber} 行: ${error}`);
    }
  }

  return envFile;
}

/**
 * 判断环境变量是否包含敏感信息
 * @param key 变量名
 * @param value 变量值
 * @returns 是否包含敏感信息
 */
function isSensitiveVariable(key: string, value: string): boolean {
  const sensitiveKeywords = [
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "key",
    "auth",
    "credential",
    "private",
    "cert",
    "certificate",
    "hash",
    "salt",
    "encrypt",
    "access",
    "security",
    "secure",
    "login",
    "账号",
    "密码",
    "口令",
    "秘钥",
    "验证",
    "认证",
    "jwt",
    "oauth",
    "session",
    "cookie",
    "admin",
  ];

  const lowercaseKey = key.toLowerCase();

  // 检查键名是否包含敏感关键词
  for (const keyword of sensitiveKeywords) {
    if (lowercaseKey.includes(keyword)) {
      return true;
    }
  }

  // 检查值是否符合常见敏感信息模式
  // 如JWT格式
  if (/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) {
    return true;
  }

  // 如GUID/UUID格式
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    return true;
  }

  // 如长密钥、哈希值
  if (value.length > 20 && /[A-Za-z0-9+/=]/.test(value)) {
    return true;
  }

  return false;
}

/**
 * 验证环境变量文件
 * @param envFile 环境变量文件对象
 * @returns 错误信息数组
 */
export function validateEnvFile(envFile: EnvFile): string[] {
  const errors: string[] = [];

  // 检查每个变量
  for (const variable of envFile.variables) {
    // 跳过注释行
    if (variable.isComment) continue;

    // 检查变量名
    if (!variable.key) {
      errors.push(`Line ${variable.line}: Missing variable name`);
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.key)) {
      errors.push(
        `Line ${variable.line}: Invalid variable name format: ${variable.key}`
      );
    }
  }

  // 检查重复的变量名
  const keyMap = new Map<string, number>();
  for (const variable of envFile.variables) {
    if (variable.isComment) continue;

    if (keyMap.has(variable.key)) {
      errors.push(
        `Duplicate variable name "${variable.key}" at lines ${keyMap.get(
          variable.key
        )} and ${variable.line}`
      );
    } else {
      keyMap.set(variable.key, variable.line);
    }
  }

  return errors;
}

/**
 * 解析Docker Compose文件
 * @param content Docker Compose文件内容
 * @returns 解析后的Docker Compose结构
 */
export function parseDockerCompose(content: string): DockerComposeConfig {
  try {
    // 使用js-yaml解析YAML内容
    const parsed = yaml.load(content) as any;

    const config: DockerComposeConfig = {
      version: parsed.version || "",
      services: [],
      networks: parsed.networks || {},
      volumes: parsed.volumes || {},
      hasError: false,
      errors: [],
    };

    // 解析服务
    if (parsed.services) {
      for (const [serviceName, serviceData] of Object.entries<any>(
        parsed.services
      )) {
        const service: DockerComposeService = {
          name: serviceName,
          image: serviceData.image,
          ports: serviceData.ports,
          volumes: serviceData.volumes,
          environment: serviceData.environment,
          env_file: serviceData.env_file,
          depends_on: serviceData.depends_on,
          networks: serviceData.networks,
        };

        // 处理build配置
        if (serviceData.build) {
          if (typeof serviceData.build === "string") {
            service.build = {
              context: serviceData.build,
            };
          } else {
            service.build = {
              context: serviceData.build.context || ".",
              dockerfile: serviceData.build.dockerfile,
            };
          }
        }

        config.services.push(service);
      }
    } else {
      config.hasError = true;
      config.errors.push("Docker Compose file missing 'services' section");
    }

    return config;
  } catch (error) {
    return {
      version: "",
      services: [],
      hasError: true,
      errors: [(error as Error).toString()],
    };
  }
}

/**
 * 读取Docker Compose文件
 * @param rootHandle 项目根目录句柄
 * @param filePath Docker Compose文件路径
 * @returns Docker Compose文件内容
 */
export async function readDockerCompose(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<string> {
  // 使用readDockerfile函数，逻辑相同
  return await readDockerfile(rootHandle, filePath);
}

/**
 * 验证Docker Compose结构
 * @param config Docker Compose配置
 * @returns 错误消息数组
 */
export function validateDockerCompose(config: DockerComposeConfig): string[] {
  const errors: string[] = [...config.errors];

  // 检查版本
  if (!config.version) {
    errors.push("Docker Compose file missing 'version' field");
  }

  // 检查服务
  if (config.services.length === 0) {
    errors.push("No services defined in Docker Compose file");
  } else {
    // 检查每个服务
    const serviceNames = config.services.map((s) => s.name);

    for (const service of config.services) {
      // 服务必须有image或build
      if (!service.image && !service.build) {
        errors.push(
          `Service '${service.name}' missing both 'image' and 'build' configuration`
        );
      }

      // 验证依赖服务是否存在
      if (service.depends_on) {
        for (const dependency of service.depends_on) {
          if (!serviceNames.includes(dependency)) {
            errors.push(
              `Service '${service.name}' depends on non-existent service '${dependency}'`
            );
          }
        }
      }
    }
  }

  return errors;
}

/**
 * 修复环境变量文件格式问题
 * @param content 环境变量文件内容
 * @returns 修复后的内容
 */
export function fixEnvFile(content: string): string {
  const lines = content.split("\n");
  const fixedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 跳过空行
    if (!trimmedLine) {
      fixedLines.push("");
      continue;
    }

    // 保留注释行
    if (trimmedLine.startsWith("#") || trimmedLine.startsWith("//")) {
      fixedLines.push(trimmedLine);
      continue;
    }

    // 处理环境变量行
    const eqIndex = trimmedLine.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmedLine.substring(0, eqIndex).trim();
      const value = trimmedLine.substring(eqIndex + 1).trim();

      // 固定格式：KEY=VALUE
      fixedLines.push(`${key}=${value}`);
    } else {
      // 无法修复的行保持原样
      fixedLines.push(trimmedLine);
    }
  }

  return fixedLines.join("\n");
}
