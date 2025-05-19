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
 * @param singleRound 是否只进行第一轮对话
 * @param customHistory 自定义对话历史
 * @param customSystemPrompt 自定义系统提示
 * @returns 完整的AI响应
 */
export async function testWithAI(
  prompt: string,
  onUpdate?: (chunk: string) => void,
  singleRound?: boolean,
  customHistory?: Array<{ role: string; content: string }>,
  customSystemPrompt?: string
): Promise<string> {
  try {
    // 保存对话历史
    const conversationHistory: Array<{ role: string; content: string }> =
      customHistory || [];
    let currentRound = 0;
    const maxRounds = 20;

    // 如果没有提供自定义历史，则创建新的对话历史
    if (!customHistory) {
      // 构建系统提示
      const systemPrompt =
        customSystemPrompt ||
        `你是一个强大的AI编码助手，正在帮助用户解决一个编程任务。这是一个多轮对话测试，最多进行${maxRounds}轮。

请主动分析用户提供的代码和项目信息，不要等待用户明确指示。你应该：
1. 提供深入的代码分析和见解
2. 主动识别潜在问题并提出解决方案
3. 展示对项目整体架构的理解
4. 提供具体、可操作的建议和代码示例
5. 直接基于用户消息中提供的文件内容回答问题，不要尝试调用工具来获取文件内容

注意：所有必要的文件内容已经在用户消息中提供，不需要使用工具调用来获取文件内容。

每轮对话结束时，你应该总结当前的进展，并提出下一步可能的探索方向。

在第${maxRounds}轮对话结束后，你必须提醒用户"测试已完成所有对话轮次，测试完毕。如需继续，请重新开始测试。"

你的回复应该是有帮助的、专业的，并且表现出主动性和专业性。请基于用户提供的项目信息开始第一轮对话。`;

      // 构建用户提示
      const userPrompt = prompt;

      // 添加初始消息到历史记录
      conversationHistory.push({ role: "system", content: systemPrompt });
      conversationHistory.push({ role: "user", content: userPrompt });
    }

    // 如果是自定义历史，但没有提供自定义系统提示，则添加轮次信息
    if (customHistory && customSystemPrompt) {
      // 使用提供的自定义系统提示
      // 不做任何修改，直接使用
    } else if (customHistory && !customSystemPrompt) {
      // 添加默认的轮次提示
      currentRound = Math.floor(
        customHistory.filter((msg) => msg.role === "user").length
      );
    }

    // 第一轮对话
    currentRound++;
    let response = await simulateRound(
      conversationHistory,
      currentRound,
      maxRounds,
      onUpdate,
      customSystemPrompt
    );

    // 如果不是使用自定义历史，则添加到对话历史中
    if (!customHistory) {
      conversationHistory.push({ role: "assistant", content: response });
    }

    // 如果只需要单轮对话，直接返回
    if (singleRound) {
      return response;
    }

    // 如果是使用自定义历史，则不进行后续轮次
    if (customHistory) {
      return response;
    }

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
      onUpdate(
        "\n\n测试已完成所有对话轮次，测试完毕。如需继续，请重新开始测试。"
      );
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
 * @param customSystemPrompt 自定义系统提示
 * @returns 助手响应
 */
async function simulateRound(
  history: Array<{ role: string; content: string }>,
  currentRound: number,
  maxRounds: number,
  onUpdate?: (chunk: string) => void,
  customSystemPrompt?: string
): Promise<string> {
  // 构建提示，包含轮次信息
  const roundPrompt =
    customSystemPrompt ||
    `你是一个强大的AI编码助手，正在帮助用户解决编程任务。这是第${currentRound}/${maxRounds}轮对话。

请主动分析用户提供的代码和项目信息，不要等待用户明确指示。你应该：
1. 提供深入的代码分析和见解
2. 主动识别潜在问题并提出解决方案
3. 展示对项目整体架构的理解
4. 提供具体、可操作的建议和代码示例
5. 直接基于用户消息中提供的文件内容回答问题，不要尝试调用工具来获取文件内容

注意：所有必要的文件内容已经在用户消息中提供，不需要使用工具调用来获取文件内容。

你的回复应该是有帮助的、专业的，并且表现出主动性和专业性。${
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
 * 查找与查询相关的文件路径
 * @param query 查询字符串
 * @param filePaths 文件路径数组
 * @param fileContents 可选的文件内容映射
 * @returns 包含相关文件路径的JSON字符串
 */
export async function findRelevantFiles(
  query: string,
  filePaths: string[],
  fileContents?: { [path: string]: string }
): Promise<string> {
  try {
    if (!filePaths || filePaths.length === 0) {
      return JSON.stringify({
        query,
        relevant_paths: [],
      });
    }

    // 构建提示
    let prompt = `你是一个专业的代码项目分析工具，你的任务是分析用户的查询，并从项目中找出与查询最相关的文件。
请基于文件路径和文件名的语义相关性，找出最相关的文件。
如果提供了文件内容，也请考虑内容的相关性。

用户查询: "${query}"

可用的文件路径:
${filePaths.join("\n")}
`;

    // 如果提供了文件内容，添加到提示中以提高搜索质量
    if (fileContents && Object.keys(fileContents).length > 0) {
      // 为了避免提示过长，只添加前10个文件的内容
      const contentPaths = Object.keys(fileContents).slice(0, 10);
      if (contentPaths.length > 0) {
        prompt += `\n\n以下是一些可能相关的文件内容:\n\n`;

        for (const path of contentPaths) {
          const content = fileContents[path];
          // 限制每个文件内容的长度，避免提示过长
          const truncatedContent =
            content.length > 1000
              ? content.substring(0, 1000) + "..."
              : content;

          prompt += `文件: ${path}\n内容:\n${truncatedContent}\n\n---\n\n`;
        }
      }
    }

    prompt += `\n请返回与查询最相关的文件路径列表（最多10个），按相关性从高到低排序。
只返回JSON格式，不要有任何其他解释。格式如下:
{
  "query": "用户查询",
  "relevant_paths": ["文件路径1", "文件路径2", ...]
}`;

    // 调用API获取相关文件
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "",
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的代码项目分析工具，你的任务是分析用户的查询，并从项目中找出与查询最相关的文件。",
          },
          { role: "user", content: prompt },
        ],
        referrer: "FoldaScan",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // 尝试解析JSON
    try {
      // 找到JSON部分
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = content.match(jsonRegex);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      const parsed = JSON.parse(jsonContent);

      // 确保返回的是有效的格式
      if (!parsed.relevant_paths || !Array.isArray(parsed.relevant_paths)) {
        throw new Error("Invalid response format");
      }

      return jsonContent;
    } catch (error) {
      console.error("解析文件路径结果出错:", error);
      // 如果解析失败，返回空结果
      return JSON.stringify({
        query,
        relevant_paths: [],
      });
    }
  } catch (error) {
    console.error("查找相关文件出错:", error);
    // 如果出错，返回空结果
    return JSON.stringify({
      query,
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
    // 首先检查输入是否为空或非字符串
    if (!jsonString || typeof jsonString !== "string") {
      return {
        query: "",
        relevant_paths: [],
      };
    }

    // 检查是否包含markdown代码块
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonToParse = jsonMatch ? jsonMatch[1].trim() : jsonString;

    // 检查是否是Python代码或其他非JSON内容
    if (
      jsonToParse.startsWith("python") ||
      jsonToParse.startsWith("import") ||
      !jsonToParse.includes("{")
    ) {
      console.warn("收到非JSON内容:", jsonToParse.substring(0, 50) + "...");
      return {
        query: "",
        relevant_paths: [],
      };
    }

    // 尝试提取JSON部分
    const jsonBracketMatch = jsonToParse.match(/(\{[\s\S]*\})/);
    if (jsonBracketMatch) {
      jsonToParse = jsonBracketMatch[1];
    }

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
