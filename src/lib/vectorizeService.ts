/**
 * 向量化服务模块 - 封装Pollinations API
 * 提供文件路径定位和语义分析功能
 */

// 基本配置
const API_URL = "https://text.pollinations.ai/openai";

/**
 * 基本聊天完成请求
 * @param messages 消息数组，包含role和content
 * @param options 可选配置项
 * @returns 响应结果
 */
export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    seed?: number;
    private?: boolean;
    referrer?: string;
    stream?: boolean;
    onUpdate?: (chunk: string) => void;
  } = {}
) {
  const payload = {
    model: options.model || "",
    messages: messages,
    seed: options.seed,
    private: options.private,
    referrer: options.referrer || "FoldaScan",
    stream: options.stream || false,
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    // 处理流式响应
    if (options.stream && options.onUpdate && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理缓冲区中的完整事件
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留最后一个可能不完整的行

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                options.onUpdate(content);
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      return { choices: [{ message: { content: "Stream completed" } }] };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error posting chat completion:", error);
    throw error;
  }
}

/**
 * 使用AI测试向量化结果（多轮对话版本）
 * @param prompt 向量化生成的Markdown文本
 * @param onUpdate 流式更新回调函数
 * @returns 完整的AI响应
 */
export async function testWithAI(
  prompt: string,
  onUpdate?: (chunk: string) => void
): Promise<string> {
  try {
    // 保存对话历史
    const conversationHistory: Array<{ role: string; content: string }> = [];
    let currentRound = 0;
    const maxRounds = 5;

    // 构建系统提示
    const systemPrompt = `你是一个强大的AI编码助手，正在帮助用户解决一个编程任务。这是一个多轮对话测试，最多进行${maxRounds}轮。
    
在回复中，你必须遵循以下格式要求：

1. 每轮对话都应该包含至少一个工具调用卡片的模拟展示，格式如下：
\`\`\`tool-card
工具名称: codebase_search/read_file/edit_file等
参数: 
  - 参数1: 值1
  - 参数2: 值2
结果:
  这里是工具调用的模拟结果...
\`\`\`

2. 每轮对话结束时，你应该总结当前的进展，并提示用户继续对话。

3. 在第${maxRounds}轮对话结束后，你必须提醒用户"测试已完成5轮对话，测试完毕。如需继续，请重新开始测试。"

4. 每轮对话中，你应该参考之前轮次的上下文，表现出连贯的思考过程。

5. 你的回复应该是有帮助的、专业的，并且与用户提供的项目信息相关。


请基于用户提供的项目信息开始第一轮对话。`;

    // 构建用户提示
    const userPrompt = prompt;

    // 添加初始消息到历史记录
    conversationHistory.push({ role: "system", content: systemPrompt });
    conversationHistory.push({ role: "user", content: userPrompt });

    // 第一轮对话
    currentRound++;
    let response = await simulateRound(
      conversationHistory,
      currentRound,
      maxRounds,
      onUpdate
    );
    conversationHistory.push({ role: "assistant", content: response });

    // 模拟用户输入，继续对话
    for (let i = 1; i < maxRounds; i++) {
      currentRound++;
      // 模拟用户输入
      const userFollowUp = `请继续分析项目，提供第${currentRound}轮的见解。`;
      conversationHistory.push({ role: "user", content: userFollowUp });

      // 获取助手响应
      response = await simulateRound(
        conversationHistory,
        currentRound,
        maxRounds,
        onUpdate
      );
      conversationHistory.push({ role: "assistant", content: response });

      // 在每轮结束后添加分隔符
      if (onUpdate) {
        onUpdate("\n\n---\n\n");
      }
    }

    // 最终提醒
    if (onUpdate) {
      onUpdate("\n\n测试已完成5轮对话，测试完毕。如需继续，请重新开始测试。");
    }

    // 返回完整对话历史
    return conversationHistory
      .filter((msg) => msg.role !== "system")
      .map(
        (msg) => `${msg.role === "user" ? "用户" : "AI助手"}：${msg.content}`
      )
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("Error testing with AI:", error);
    return "测试过程中发生错误，请重试。";
  }
}

/**
 * 模拟单轮对话
 * @param history 对话历史
 * @param currentRound 当前轮次
 * @param maxRounds 最大轮次
 * @param onUpdate 更新回调
 * @returns 助手响应
 */
async function simulateRound(
  history: Array<{ role: string; content: string }>,
  currentRound: number,
  maxRounds: number,
  onUpdate?: (chunk: string) => void
): Promise<string> {
  // 构建提示，包含轮次信息
  const roundPrompt = `这是第${currentRound}/${maxRounds}轮对话。请根据项目信息提供分析，并在回复中包含至少一个工具调用卡片的模拟展示。${
    currentRound === maxRounds
      ? "这是最后一轮对话，请在回复结束时提醒用户测试完毕并做出总结。"
      : ""
  }`;

  // 添加轮次提示到历史
  const conversationWithRound = [
    ...history,
    { role: "system", content: roundPrompt },
  ];

  // 调用API获取响应
  let response = "";
  await chatCompletion(conversationWithRound, {
    model: "",
    stream: true,
    onUpdate: (chunk) => {
      response += chunk;
      if (onUpdate) {
        onUpdate(chunk);
      }
    },
  });

  return response;
}

/**
 * 智能文件路径定位和语义分析服务
 * @param query 用户查询文本
 * @param filePaths 项目中的文件路径列表
 * @param fileContents 可选的文件内容映射，用于内容匹配
 * @returns 相关文件路径列表的JSON字符串
 */
export async function findRelevantFiles(
  query: string,
  filePaths: string[],
  fileContents?: { [path: string]: string }
): Promise<string> {
  // 如果没有提供有效的查询，返回空结果
  if (!query || query.trim() === "") {
    return JSON.stringify({
      query: "",
      relevant_paths: [],
    });
  }

  // 如果文件路径列表为空，返回空结果
  if (!filePaths || filePaths.length === 0) {
    return JSON.stringify({
      query: query,
      relevant_paths: [],
    });
  }

  // 处理特殊查询："介绍一下项目"
  if (query.toLowerCase().includes("介绍一下项目")) {
    // 寻找重要的项目文件
    const importantFiles = filePaths.filter((path) => {
      const lowerPath = path.toLowerCase();
      return (
        lowerPath.includes("readme") ||
        lowerPath.endsWith("package.json") ||
        lowerPath.endsWith("tsconfig.json") ||
        lowerPath.includes("main") ||
        lowerPath.includes("index") ||
        lowerPath.includes("app") ||
        (lowerPath.includes("src") && lowerPath.includes("components"))
      );
    });

    // 如果找到了重要文件，直接返回
    if (importantFiles.length > 0) {
      const result = {
        query: query,
        relevant_paths: importantFiles.slice(0, 10), // 限制最多10个文件
      };
      return JSON.stringify(result);
    }
  }

  // 处理SQL相关查询
  if (
    query.toLowerCase().includes("sql") ||
    query.toLowerCase().includes("数据库") ||
    query.toLowerCase().includes("database")
  ) {
    // 寻找SQL相关文件
    const sqlFiles = filePaths.filter((path) => {
      const lowerPath = path.toLowerCase();
      return (
        lowerPath.endsWith(".sql") ||
        lowerPath.includes("sql") ||
        lowerPath.includes("database") ||
        lowerPath.includes("db") ||
        lowerPath.includes("model") ||
        lowerPath.includes("schema") ||
        lowerPath.includes("migration")
      );
    });

    // 如果找到了SQL相关文件，直接返回
    if (sqlFiles.length > 0) {
      const result = {
        query: query,
        relevant_paths: sqlFiles.slice(0, 10), // 限制最多10个文件
      };
      return JSON.stringify(result);
    }
  }

  // 处理Python相关查询
  if (
    query.toLowerCase().includes("py") ||
    query.toLowerCase().includes("python") ||
    query.toLowerCase().includes("脚本")
  ) {
    // 寻找Python相关文件
    const pyFiles = filePaths.filter((path) => {
      const lowerPath = path.toLowerCase();
      return (
        lowerPath.endsWith(".py") ||
        lowerPath.includes("python") ||
        lowerPath.includes("py") ||
        lowerPath.includes("script")
      );
    });

    // 如果找到了Python相关文件，直接返回
    if (pyFiles.length > 0) {
      const result = {
        query: query,
        relevant_paths: pyFiles.slice(0, 10), // 限制最多10个文件
      };
      return JSON.stringify(result);
    }
  }

  // 构建系统提示
  let systemPrompt = `请你扮演一个智能的文件路径定位助手和语义分析引擎。

**任务**：
1. **接收输入**：
   * 一个自然语言描述文本 (\`query\`)，表达用户想要查找的文件、组件、功能或相关资源。
   * 一个包含项目中所有文件路径的列表 (\`file_paths_list\`)。`;

  // 如果提供了文件内容，添加相关说明
  if (fileContents && Object.keys(fileContents).length > 0) {
    systemPrompt += `
   * 一个包含部分文件内容的映射 (\`file_contents\`)，可用于内容匹配。`;
  }

  systemPrompt += `

2. **理解 \`query\`**：
   * 对 \`query\` 进行细致的语义分析，拆解出其中的核心概念、实体（如页面名称、UI元素、功能模块、数据类型）、操作意图（如"修改"、"显示"、"配置"）以及关键属性或技术（如"竖向"、"SVG"、"API"、"认证"）。
   * 识别与文件命名、目录结构、文件类型（如 \`.js\`, \`.vue\`, \`.css\`, \`.svg\`, \`.md\`, \`.py\`, \`.java\`）相关的关键词。

3. **智能匹配文件路径**：
   * 遍历 \`file_paths_list\` 中的每一个文件路径。
   * 对于每个文件路径，将其分解为目录名、文件名和扩展名。
   * **核心匹配逻辑**：
       * **关键词匹配**：检查 \`query\` 中识别出的关键词（或其合理变体、同义词）是否直接出现在文件路径的任何部分（目录、文件名）。
       * **语义关联**：评估文件路径的组成部分（特别是文件名和直接父目录）与 \`query\` 核心概念的语义相似度。
       * **文件类型推断**：根据 \`query\` 中提及的技术或元素类型，优先匹配相应扩展名的文件。
       * **上下文与约定**：考虑常见的项目结构和命名约定。`;

  // 如果提供了文件内容，添加内容匹配逻辑
  if (fileContents && Object.keys(fileContents).length > 0) {
    systemPrompt += `
       * **内容匹配**：对于提供了内容的文件，分析其内容是否与查询相关。查找与查询关键词相关的代码片段、注释、文档字符串等。`;
  }

  systemPrompt += `

4. **项目概览请求处理**：
   * 如果查询是关于项目整体介绍或概览（如"介绍一下项目"、"项目结构"、"项目概述"等），请优先返回：
     * README.md 或其他说明文档
     * package.json、tsconfig.json 等配置文件
     * 主要入口文件（如 index.js、main.js、App.tsx 等）
     * 核心组件文件
     * 项目结构定义文件

5. **返回结果**：
   * 找出 \`file_paths_list\` 中与 \`query\` 语义最相关的一个或多个文件路径。
   * 按照以下指定的JSON格式返回结果。如果找不到高度相关的路径，可以返回空列表或相关性稍低的候选项。
   * 对于项目概览类请求，尽量返回5-10个最能代表项目架构和功能的文件。

**重要提示**：
- 你必须直接返回一个有效的JSON对象，不要添加任何markdown代码块（如\`\`\`json）或其他格式化。
- 你的回复必须是可以直接被JSON.parse()解析的纯JSON字符串。
- 即使找不到任何相关文件，也要返回空的relevant_paths数组，而不是null或undefined。

**JSON输出格式示例**：
{
  "query": "原始输入文本",
  "relevant_paths": [
    "src/components/navigation/VerticalTabs.svg",
    "src/views/HomePage/sections/TabbedContent.vue"
  ]
}`;

  // 构建用户提示
  let userPrompt = `query: "${query}"
file_paths_list: ${JSON.stringify(filePaths, null, 2)}`;

  // 如果提供了文件内容，添加到用户提示中
  if (fileContents && Object.keys(fileContents).length > 0) {
    userPrompt += `\nfile_contents: ${JSON.stringify(fileContents, null, 2)}`;
  }

  userPrompt += `\n\n请直接返回纯JSON格式，不要添加任何markdown代码块或其他格式化。`;

  // 构建消息数组
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    // 调用API获取结果
    const result = await chatCompletion(messages, {
      model: "",
      seed: Math.floor(Math.random() * 1000),
    });

    // 确保返回的是有效的JSON字符串
    const content = result.choices[0].message.content;
    console.log("API原始返回:", content);

    try {
      // 检查是否包含markdown代码块
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonToParse = jsonMatch ? jsonMatch[1].trim() : content;

      console.log("准备解析的JSON:", jsonToParse);

      // 尝试解析JSON字符串
      const parsed = JSON.parse(jsonToParse);
      if (!parsed.query) {
        parsed.query = query;
      }
      if (!Array.isArray(parsed.relevant_paths)) {
        parsed.relevant_paths = [];
      }
      return JSON.stringify(parsed);
    } catch (parseError) {
      // 如果解析失败，返回一个有效的默认JSON
      console.error("Failed to parse API response as JSON:", parseError);
      return JSON.stringify({
        query: query,
        relevant_paths: [],
      });
    }
  } catch (error) {
    console.error("Error finding relevant files:", error);
    // 出错时返回一个有效的默认JSON
    return JSON.stringify({
      query: query,
      relevant_paths: [],
    });
  }
}

/**
 * 解析文件路径查询结果
 * @param jsonString 文件路径查询返回的JSON字符串
 * @returns 解析后的结果对象
 */
export function parseFilePathsResult(jsonString: string): {
  query: string;
  relevant_paths: string[];
} {
  try {
    // 检查是否包含markdown代码块
    console.log("原始JSON:", jsonString);
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonToParse = jsonMatch ? jsonMatch[1].trim() : jsonString;

    console.log("准备解析的JSON:", jsonToParse);

    // 尝试解析JSON字符串
    const result = JSON.parse(jsonToParse);

    // 验证结果格式
    if (!result.query || !Array.isArray(result.relevant_paths)) {
      console.warn("JSON格式不完整:", result);
      return {
        query: result.query || "",
        relevant_paths: Array.isArray(result.relevant_paths)
          ? result.relevant_paths
          : [],
      };
    }

    return {
      query: result.query,
      relevant_paths: result.relevant_paths,
    };
  } catch (error) {
    console.error("Error parsing file paths result:", error);
    // 返回默认值
    return {
      query: "",
      relevant_paths: [],
    };
  }
}
