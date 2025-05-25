/**
 * 向量化服务模块 - 封装Pollinations API
 * 提供文件路径定位和语义分析功能
 * 以及文件操作功能，支持智能体修改、删除和创建文件
 */

import { getAllKnowledgeEntries } from "./knowledgeService";
import { getDefaultLocale } from "./i18n";

// 基本配置
const API_URL = "https://text.pollinations.ai/openai";
const API_KEY = "";
const Model = "";
/**
 * 根据当前语言获取本地化的提示词
 * @param zh 中文提示词
 * @param en 英文提示词
 * @returns 根据当前语言返回相应的提示词
 */
export function getLocalizedPrompt(zh: string, en: string): string {
  const locale = getDefaultLocale();
  return locale === "zh" ? zh : en;
}

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
    console.log("messages ", messages);
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
    const maxRounds = 60;

    // 如果没有提供自定义历史，则创建新的对话历史
    if (!customHistory) {
      // 构建系统提示
      const systemPrompt =
        customSystemPrompt ||
        getLocalizedPrompt(
          `你是一个强大的AI编码助手，正在帮助用户解决一个编程任务。这是一个多轮对话测试，最多进行${maxRounds}轮。

请主动分析用户提供的代码和项目信息，不要等待用户明确指示。你应该：
1. 提供深入的代码分析和见解
2. 主动识别潜在问题并提出解决方案
3. 展示对项目整体架构的理解
4. 提供具体、可操作的建议

重要格式指南：
- 只在显示实际代码片段时才使用代码块（\`\`\`语言 ...代码... \`\`\`）
- **代码块语言标识符必须使用标准名称，如：javascript、typescript、python、html、css等，不要使用lang-前缀**
- 避免在普通解释文本,名词,文件夹,文件名中使用代码块格式
- 当引用变量名、函数名或简短代码片段时，使用单行代码格式（\`代码\`）而非代码块
- 对于文件名，请使用单行代码格式，例如：\`filename.tsx\` 而非 \`\`\`filename.tsx\`\`\`
- 对于函数名和关键字，请使用单行代码格式，例如：\`function\` 而非 \`\`\`function\`\`\`
- **非常重要：当引用源代码区域时，必须使用以下格式：\`\`\`起始行:结束行:文件路径\`\`\`**
  例如：\`\`\`12:15:app/components/Todo.tsx\`\`\` 这将显示为带有文件路径和行号的特殊格式
- 保持回答清晰简洁，避免不必要的标记和格式
- 长代码片段使用代码块格式

注意：所有必要的文件内容已经在用户消息中提供，不需要使用工具调用来获取文件内容。直接基于用户消息中提供的文件内容回答问题。

每轮对话结束时，你应该总结当前的进展，并提出下一步可能的探索方向。

在第${maxRounds}轮对话结束后，你必须提醒用户"测试已完成所有对话轮次，测试完毕。如需继续，请重新开始测试。"

你的回复应该是有帮助的、专业的，并且表现出主动性和专业性。请基于用户提供的项目信息开始第一轮对话。`,
          `You are a powerful AI coding assistant helping the user solve a programming task. This is a multi-round conversation test with a maximum of ${maxRounds} rounds.

Please actively analyze the code and project information provided by the user, without waiting for explicit instructions. You should:
1. Provide in-depth code analysis and insights
2. Proactively identify potential issues and suggest solutions
3. Demonstrate understanding of the overall project architecture
4. Offer specific, actionable advice

Important formatting guidelines:
- Only use code blocks (\`\`\`language ...code... \`\`\`) when displaying actual code snippets
- **Code block language identifiers must use standard names like: javascript, typescript, python, html, css, etc. Do NOT use lang- prefix**
- Avoid using code block formatting for regular explanatory text, nouns, folder names, or file names
- When referencing variable names, function names, or short code snippets, use inline code format (\`code\`) rather than code blocks
- Keep your answers clear and concise, avoiding unnecessary markup and formatting
- Use code block formatting for long code snippets
- For file names, please use inline code format, for example: \`filename.tsx\` rather than \`\`\`filename.tsx\`\`\`
- For function names and keywords, please use inline code format, for example: \`function\` rather than \`\`\`function\`\`\`
- **VERY IMPORTANT: When referencing source code regions, you MUST use the format: \`\`\`startLine:endLine:filePath\`\`\`**
   For example: \`\`\`12:15:app/components/Todo.tsx\`\`\` This will be displayed as a special format with file path and line numbers
- Keep your answers clear and concise, avoiding unnecessary markup and formatting

Note: All necessary file contents have already been provided in the user's message. You don't need to use tool calls to get file contents. Answer questions directly based on the file contents provided in the user's message.

At the end of each conversation round, you should summarize the current progress and suggest possible directions for further exploration.

After the ${maxRounds}th round of conversation, you must remind the user "The test has completed all conversation rounds. Test complete. To continue, please restart the test."

Your responses should be helpful, professional, and demonstrate proactivity and expertise. Please start the first round of conversation based on the project information provided by the user.`
        );

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
      const userFollowUp = getLocalizedPrompt(
        `请继续分析项目，提供第${currentRound}轮的见解。`,
        `Please continue analyzing the project and provide insights for round ${currentRound}.`
      );
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
        getLocalizedPrompt(
          "\n\n测试已完成所有对话轮次，测试完毕。如需继续，请重新开始测试。",
          "\n\nThe test has completed all conversation rounds. Test complete. To continue, please restart the test."
        )
      );
    }

    // 返回完整对话历史
    return conversationHistory
      .filter((msg) => msg.role !== "system")
      .map(
        (msg) =>
          `${
            msg.role === "user"
              ? getLocalizedPrompt("用户", "User")
              : getLocalizedPrompt("FoldaScan Agent", "FoldaScan Agent")
          }：${msg.content}`
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
    getLocalizedPrompt(
      `你是一个强大的AI编码助手，正在帮助用户解决编程任务。这是第${currentRound}/${maxRounds}轮对话。

请主动分析用户提供的代码和项目信息，不要等待用户明确指示。你应该：
1. 提供深入的代码分析和见解
2. 主动识别潜在问题并提出解决方案
3. 展示对项目整体架构的理解
4. 提供具体、可操作的建议

重要格式指南：
- 只在显示实际代码片段时才使用代码块（\`\`\`语言 ...代码... \`\`\`）
- **代码块语言标识符必须使用标准名称，如：javascript、typescript、python、html、css等，不要使用lang-前缀**
- 避免在普通解释文本中使用代码块格式
- 当引用变量名、函数名或简短代码片段时，使用单行代码格式（\`代码\`）而非代码块
- 对于文件名，请使用单行代码格式，例如：\`filename.tsx\` 而非 \`\`\`filename.tsx\`\`\`
- 对于函数名和关键字，请使用单行代码格式，例如：\`function\` 而非 \`\`\`function\`\`\`
- **非常重要：当引用源代码区域时，必须使用以下格式：\`\`\`起始行:结束行:文件路径\`\`\`**
  例如：\`\`\`12:15:app/components/Todo.tsx\`\`\` 这将显示为带有文件路径和行号的特殊格式
- 保持回答清晰简洁，避免不必要的标记和格式

注意：所有必要的文件内容已经在用户消息中提供，不需要使用工具调用来获取文件内容。直接基于用户消息中提供的文件内容回答问题。

你的回复应该是有帮助的、专业的，并且表现出主动性和专业性。${
        currentRound === maxRounds
          ? "这是最后一轮对话，请在回复结束时提醒用户测试完毕并做出总结。"
          : ""
      }`,
      `You are a powerful AI coding assistant helping the user solve programming tasks. This is round ${currentRound}/${maxRounds} of the conversation.

Please actively analyze the code and project information provided by the user, without waiting for explicit instructions. You should:
1. Provide in-depth code analysis and insights
2. Proactively identify potential issues and suggest solutions
3. Demonstrate understanding of the overall project architecture
4. Offer specific, actionable advice

Important formatting guidelines:
- Only use code blocks (\`\`\`language ...code... \`\`\`) when displaying actual code snippets
- **Code block language identifiers must use standard names like: javascript, typescript, python, html, css, etc. Do NOT use lang- prefix**
- Avoid using code block formatting for regular explanatory text, nouns, folder names, or file names
- When referencing variable names, function names, or short code snippets, use inline code format (\`code\`) rather than code blocks
- Keep your answers clear and concise, avoiding unnecessary markup and formatting
- Use code block formatting for long code snippets
- For file names, please use inline code format, for example: \`filename.tsx\` rather than \`\`\`filename.tsx\`\`\`
- For function names and keywords, please use inline code format, for example: \`function\` rather than \`\`\`function\`\`\`
- **VERY IMPORTANT: When referencing source code regions, you MUST use the format: \`\`\`startLine:endLine:filePath\`\`\`**
   For example: \`\`\`12:15:app/components/Todo.tsx\`\`\` This will be displayed as a special format with file path and line numbers
- Keep your answers clear and concise, avoiding unnecessary markup and formatting

Note: All necessary file contents have already been provided in the user's message. You don't need to use tool calls to get file contents. Answer questions directly based on the file contents provided in the user's message.

Your responses should be helpful, professional, and demonstrate proactivity and expertise.${
        currentRound === maxRounds
          ? " This is the final round of conversation, please remind the user that the test is complete and provide a summary at the end of your response."
          : ""
      }`
    );

  // 添加轮次提示到历史
  const conversationWithRound = [
    ...history,
    { role: "system", content: roundPrompt },
  ];

  // 调用API获取响应
  let response = "";
  const models = ["", "", "", "openai-large"];
  const randomModel = models[Math.floor(Math.random() * models.length)];
  await chatCompletion(conversationWithRound, {
    model: randomModel,
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
 * 查找与查询相关的文件路径和知识库条目
 * @param query 查询字符串
 * @param filePaths 文件路径数组
 * @param fileContents 可选的文件内容映射
 * @returns 包含相关文件路径和知识库条目的JSON字符串
 */
export async function findRelevantFiles(
  query: string,
  filePaths: string[],
  fileContents?: { [path: string]: string },
  codeStructure?: any
): Promise<string> {
  try {
    // 添加调试日志
    console.log("vectorizeService收到的filePaths:", filePaths);
    console.log("filePaths是否为数组:", Array.isArray(filePaths));
    console.log("filePaths长度:", filePaths ? filePaths.length : "undefined");
    console.log("filePaths类型:", typeof filePaths);

    // 获取知识库内容
    const knowledgeEntries = await getKnowledgeContent();

    // 移除这个检查，确保即使没有文件或知识库内容也能继续处理
    // 如果文件路径为空，则返回空结果但不中断处理
    if (!filePaths || filePaths.length === 0) {
      console.warn("没有提供文件路径，将只检索知识库内容");
      // 如果知识库也为空，则返回空结果
      if (knowledgeEntries.length === 0) {
        console.warn("知识库也为空，返回空结果");
      }
      // 不再提前返回，继续执行向量匹配逻辑
    }

    // 构建提示
    const basePrompt = getLocalizedPrompt(
      `你是一个专业的代码项目分析工具，你的任务是分析用户的查询，并从项目中找出与查询最相关的文件和知识库条目。
请基于文件路径、文件名以及知识库条目标题的语义相关性，找出最相关的资源。
如果提供了文件内容，也请考虑内容的相关性。
你还可以基于文件中的函数和方法名称进行匹配，某些文件路径中包含了函数信息，格式为: "文件路径 (函数类型:函数名[行号], ...)"。
此外，你还应该考虑模块导入、变量定义和重要注释等额外信息。

用户查询: "${query}"

可用的文件路径:`,
      `You are a professional code project analysis tool. Your task is to analyze the user's query and find the most relevant files and knowledge base entries from the project.
Please identify the most relevant resources based on the semantic relevance of file paths, file names, and knowledge base entry titles.
If file contents are provided, please also consider the relevance of the content.
You can also match based on function and method names within files. Some file paths include function information in the format: "file_path (function_type:function_name[line_numbers], ...)".
Additionally, you should consider module imports, variable definitions, and important comments as extra information.

User query: "${query}"

Available file paths:`
    );

    let prompt = basePrompt;

    // 添加文件路径信息
    if (filePaths && Array.isArray(filePaths) && filePaths.length > 0) {
      // 每行一个文件路径
      prompt += "\n" + filePaths.join("\n");
    } else {
      prompt += getLocalizedPrompt(
        "\n没有可用的文件路径",
        "\nNo available file paths"
      );
    }

    // 添加知识库条目信息
    if (knowledgeEntries.length > 0) {
      prompt += getLocalizedPrompt(
        `\n\n可用的知识库条目标题:\n`,
        `\n\nAvailable knowledge base entry titles:\n`
      );
      knowledgeEntries.forEach((entry, index) => {
        prompt += `${index + 1}. ${entry.title}\n`;
      });
    } else {
      prompt += getLocalizedPrompt(
        `\n\n没有可用的知识库条目\n`,
        `\n\nNo available knowledge base entries\n`
      );
    }

    // 添加代码结构信息（如果提供）
    if (codeStructure) {
      // 添加模块导入信息
      if (codeStructure.modules && codeStructure.modules.length > 0) {
        prompt += getLocalizedPrompt(
          `\n\n项目中的模块导入信息:\n`,
          `\n\nModule imports in the project:\n`
        );

        // 仅添加前20个模块导入，避免提示过长
        const modulesToShow = codeStructure.modules.slice(0, 20);
        modulesToShow.forEach((mod: any) => {
          prompt += `- ${mod.filePath}: 导入 ${mod.name}${
            mod.isExternal ? " (外部模块)" : " (内部模块)"
          }\n`;
        });

        if (codeStructure.modules.length > 20) {
          prompt += getLocalizedPrompt(
            `... 以及其他 ${codeStructure.modules.length - 20} 个模块导入\n`,
            `... and ${codeStructure.modules.length - 20} more module imports\n`
          );
        }
      }

      // 添加变量信息
      if (codeStructure.variables && codeStructure.variables.length > 0) {
        prompt += getLocalizedPrompt(
          `\n\n项目中的重要变量定义:\n`,
          `\n\nImportant variable definitions in the project:\n`
        );

        // 仅添加前20个常量变量，避免提示过长
        const constantsToShow = codeStructure.variables
          .filter((v: any) => v.isConst)
          .slice(0, 20);

        constantsToShow.forEach((v: any) => {
          prompt += `- ${v.filePath}: ${v.name}${
            v.type ? ": " + v.type : ""
          }\n`;
        });

        if (constantsToShow.length > 20) {
          prompt += getLocalizedPrompt(
            `... 以及其他常量\n`,
            `... and other constants\n`
          );
        }
      }

      // 添加重要注释信息
      if (codeStructure.comments && codeStructure.comments.length > 0) {
        const importantComments = codeStructure.comments.filter(
          (c: any) => c.isImportant
        );

        if (importantComments.length > 0) {
          prompt += getLocalizedPrompt(
            `\n\n项目中的重要注释:\n`,
            `\n\nImportant comments in the project:\n`
          );

          // 仅添加前10个重要注释，避免提示过长
          const commentsToShow = importantComments.slice(0, 10);
          commentsToShow.forEach((c: any) => {
            prompt += `- ${c.filePath} [行 ${c.line}]: ${c.content.substring(
              0,
              50
            )}${c.content.length > 50 ? "..." : ""}\n`;
          });

          if (importantComments.length > 10) {
            prompt += getLocalizedPrompt(
              `... 以及其他 ${importantComments.length - 10} 个重要注释\n`,
              `... and ${
                importantComments.length - 10
              } more important comments\n`
            );
          }
        }
      }
    }

    // 如果提供了文件内容，添加到提示中以提高搜索质量
    if (fileContents && Object.keys(fileContents).length > 0) {
      // 为了避免提示过长，只添加前10个文件的内容
      const contentPaths = Object.keys(fileContents).slice(0, 10);
      if (contentPaths.length > 0) {
        prompt += getLocalizedPrompt(
          `\n\n以下是一些可能相关的文件内容:\n\n`,
          `\n\nHere are some potentially relevant file contents:\n\n`
        );

        for (const path of contentPaths) {
          const content = fileContents[path];
          // 限制每个文件内容的长度，避免提示过长
          const truncatedContent =
            content.length > 100000
              ? content.substring(0, 100000) + "..."
              : content;

          // 添加行号到每行，但跳过函数信息注释
          const contentWithLineNumbers = (() => {
            const lines = truncatedContent.split("\n");

            // 检查是否包含函数信息注释
            const hasFunctionInfo =
              lines.length > 2 &&
              lines[0].includes("文件中的函数和方法:") &&
              lines[0].startsWith("/*");

            // 找到实际内容的起始行
            let startIndex = 0;
            if (hasFunctionInfo) {
              // 查找注释结束位置
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes("*/")) {
                  // 注释结束行的下一行才是实际内容
                  startIndex = i + 1;
                  // 如果下一行是空行，再跳过一行
                  if (startIndex < lines.length && !lines[startIndex].trim()) {
                    startIndex++;
                  }
                  break;
                }
              }
            }

            // 只给实际内容添加行号
            return lines
              .map((line, index) => {
                // 如果是函数信息注释部分，不添加行号
                if (index < startIndex) {
                  return line;
                }
                // 对实际内容添加行号，行号从1开始
                return `${index - startIndex + 1} ${line}`;
              })
              .join("\n");
          })();

          prompt += getLocalizedPrompt(
            `文件: ${path}\n内容:\n${contentWithLineNumbers}\n\n---\n\n`,
            `File: ${path}\nContent:\n${contentWithLineNumbers}\n\n---\n\n`
          );
        }
      }
    }

    const finalInstructions = getLocalizedPrompt(
      `\n请返回与查询最相关的资源列表，包括文件路径和知识库条目标题，按相关性从高到低排序。
每类资源最多返回10个，按相关性从高到低排序。
必须确保返回至少2个相关文件路径，即使匹配度不高也要返回最相关的几个。
只返回JSON格式，不要有任何其他解释。格式如下:
{
  "query": "用户查询",
  "relevant_paths": ["文件路径1", "文件路径2", ...],
  "knowledge_entries": ["知识条目标题1", "知识条目标题2", ...]
}`,
      `\nPlease return a list of resources most relevant to the query, including file paths and knowledge base entry titles, sorted by relevance from highest to lowest.
Return at most 10 resources for each category, sorted by relevance from highest to lowest.
Make sure to return at least 2 relevant file paths, even if the match score is low, return the most relevant ones.
Return only JSON format, without any other explanation. Format as follows:
{
  "query": "user query",
  "relevant_paths": ["file path 1", "file path 2", ...],
  "knowledge_entries": ["knowledge entry title 1", "knowledge entry title 2", ...]
}`
    );

    prompt += finalInstructions;

    // 调用API获取相关资源
    console.log("正在调用API，发送的prompt:", prompt);

    const systemPrompt = getLocalizedPrompt(
      "你是一个专业的代码项目分析工具，你的任务是分析用户的查询，并从项目中找出与查询最相关的文件和知识库条目。必须至少返回2个相关文件路径，即使相关性不高。",
      "You are a professional code project analysis tool. Your task is to analyze the user's query and find the most relevant files and knowledge base entries from the project. You must return at least 2 relevant file paths, even if the relevance is low."
    );

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "",
        messages: [
          {
            role: "system",
            content: systemPrompt,
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
    console.log("API返回内容:", content);

    // 尝试解析JSON
    try {
      // 找到JSON部分
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = content.match(jsonRegex);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      const parsed = JSON.parse(jsonContent);

      // 确保返回的是有效的格式
      if (!parsed.relevant_paths || !Array.isArray(parsed.relevant_paths)) {
        parsed.relevant_paths = [];
      }

      // 确保知识库条目字段存在
      if (
        !parsed.knowledge_entries ||
        !Array.isArray(parsed.knowledge_entries)
      ) {
        parsed.knowledge_entries = [];
      }

      // 如果文件路径为空，但有可用的文件路径，至少返回前两个
      if (
        parsed.relevant_paths.length === 0 &&
        filePaths &&
        filePaths.length > 0
      ) {
        console.warn("API返回的relevant_paths为空，将添加默认文件");
        parsed.relevant_paths = filePaths.slice(
          0,
          Math.min(5, filePaths.length)
        );
      }

      return JSON.stringify(parsed);
    } catch (error) {
      console.error("解析相关资源结果出错:", error);
      // 如果解析失败，返回带默认文件路径的结果
      const defaultResult = {
        query,
        relevant_paths: filePaths
          ? filePaths.slice(0, Math.min(5, filePaths.length))
          : [],
        knowledge_entries: [],
      };
      return JSON.stringify(defaultResult);
    }
  } catch (error) {
    console.error("查找相关资源出错:", error);
    // 如果出错，返回带默认文件路径的结果
    const defaultResult = {
      query,
      relevant_paths: filePaths
        ? filePaths.slice(0, Math.min(5, filePaths.length))
        : [],
      knowledge_entries: [],
    };
    return JSON.stringify(defaultResult);
  }
}

/**
 * 解析文件路径和知识库条目查询结果
 * @param jsonString 查询返回的JSON字符串
 * @returns 解析后的结果对象
 */
export function parseFilePathsResult(jsonString: string): {
  query: string;
  relevant_paths: string[];
  knowledge_entries: string[];
} {
  try {
    // 首先检查输入是否为空或非字符串
    if (!jsonString || typeof jsonString !== "string") {
      return {
        query: "",
        relevant_paths: [],
        knowledge_entries: [],
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
        knowledge_entries: [],
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
    if (!result.query) {
      console.warn("JSON格式不完整 - 缺少query字段:", result);
      result.query = "";
    }

    if (!Array.isArray(result.relevant_paths)) {
      console.warn(
        "JSON格式不完整 - 缺少relevant_paths字段或格式不正确:",
        result
      );
      result.relevant_paths = [];
    }

    if (!Array.isArray(result.knowledge_entries)) {
      console.warn(
        "JSON格式不完整 - 缺少knowledge_entries字段或格式不正确:",
        result
      );
      result.knowledge_entries = [];
    }

    return {
      query: result.query || "",
      relevant_paths: Array.isArray(result.relevant_paths)
        ? result.relevant_paths
        : [],
      knowledge_entries: Array.isArray(result.knowledge_entries)
        ? result.knowledge_entries
        : [],
    };
  } catch (error) {
    console.error("Error parsing resources result:", error);
    // 返回默认值
    return {
      query: "",
      relevant_paths: [],
      knowledge_entries: [],
    };
  }
}

/**
 * 从知识库获取内容进行向量化
 * 将知识库中的条目转换为可向量化的文本
 */
export async function getKnowledgeContent(): Promise<
  { id: string; text: string; title: string }[]
> {
  try {
    const entries = await getAllKnowledgeEntries();

    return entries.map((entry) => ({
      id: entry.id,
      text: entry.content,
      title: entry.title,
    }));
  } catch (error) {
    console.error("获取知识库内容失败:", error);
    return [];
  }
}

/**
 * 向量化文本内容
 * @param text 要向量化的文本内容
 */
export async function vectorizeText(text: string): Promise<number[] | null> {
  // 向量化实现
  // 这里使用简化的算法，真实场景请使用合适的嵌入模型
  try {
    // 实际应用中应该调用embedding API获取文本向量
    // 这里使用假数据模拟向量
    const vector = new Array(128).fill(0).map(() => Math.random());
    return vector;
  } catch (error) {
    console.error("向量化文本失败:", error);
    return null;
  }
}

/**
 * 向量化所有内容（文件和知识库）
 */
export async function vectorizeAllContent(
  files: { path: string; content: string }[] = []
): Promise<
  {
    id: string;
    vector: number[];
    metadata: {
      type: string;
      title: string;
      content: string;
      path?: string;
    };
  }[]
> {
  // 存储所有向量化的文档
  const vectorizedDocuments: {
    id: string;
    vector: number[];
    metadata: {
      type: string;
      title: string;
      content: string;
      path?: string;
    };
  }[] = [];

  // 向量化文件内容
  for (const file of files) {
    const vectorizedData = await vectorizeText(file.content);

    if (vectorizedData) {
      vectorizedDocuments.push({
        id: `file-${file.path}`,
        vector: vectorizedData,
        metadata: {
          type: "file",
          title: file.path.split("/").pop() || file.path,
          content: file.content,
          path: file.path,
        },
      });
    }
  }

  // 添加知识库内容
  try {
    const knowledgeEntries = await getKnowledgeContent();

    for (const entry of knowledgeEntries) {
      const vectorizedData = await vectorizeText(entry.text);

      if (vectorizedData) {
        vectorizedDocuments.push({
          id: `knowledge-${entry.id}`,
          vector: vectorizedData,
          metadata: {
            type: "knowledge",
            title: entry.title,
            content: entry.text,
          },
        });
      }
    }
  } catch (error) {
    console.error("向量化知识库内容失败:", error);
  }

  return vectorizedDocuments;
}

/**
 * 使用搜索生成内容
 * @param keyword 搜索关键词
 * @param onUpdate 可选的流式更新回调
 * @returns 生成的内容
 */
/**
 * 获取文件句柄
 * @param filePath 文件路径（相对于项目根目录）
 * @returns 文件句柄
 */
async function getFileHandle(
  filePath: string
): Promise<FileSystemFileHandle | null> {
  try {
    // 从全局变量获取目录句柄
    const directoryHandle = window.directoryHandle;

    if (!directoryHandle) {
      console.error("未找到目录句柄，请先选择项目文件夹");
      return null;
    }

    // 分割路径
    const pathParts = filePath
      .split(/[\/\\]/)
      .filter((part) => part.length > 0);

    // 如果没有路径部分，说明文件在根目录
    if (pathParts.length === 0) {
      console.error("无效的文件路径");
      return null;
    }

    // 获取文件名（路径的最后一部分）
    const fileName = pathParts.pop() as string;

    // 导航到包含文件的目录
    let currentDir = directoryHandle;
    for (const part of pathParts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part);
      } catch (error) {
        console.error(`找不到目录: ${part}`, error);
        return null;
      }
    }

    // 获取文件句柄
    try {
      return await currentDir.getFileHandle(fileName);
    } catch (error) {
      console.error(`找不到文件: ${fileName}`, error);
      return null;
    }
  } catch (error) {
    console.error("获取文件句柄时出错:", error);
    return null;
  }
}

/**
 * 创建目录（如果不存在）
 * @param dirPath 目录路径
 * @returns 目录句柄
 */
async function createDirectory(
  dirPath: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const directoryHandle = window.directoryHandle;

    if (!directoryHandle) {
      console.error("未找到目录句柄，请先选择项目文件夹");
      return null;
    }

    // 分割路径
    const pathParts = dirPath.split(/[\/\\]/).filter((part) => part.length > 0);

    // 如果没有路径部分，返回根目录
    if (pathParts.length === 0) {
      return directoryHandle;
    }

    // 逐级创建目录
    let currentDir = directoryHandle;
    for (const part of pathParts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part, {
          create: true,
        });
      } catch (error) {
        console.error(`无法创建目录: ${part}`, error);
        return null;
      }
    }

    return currentDir;
  } catch (error) {
    console.error("创建目录时出错:", error);
    return null;
  }
}

/**
 * 修改文件内容
 * @param filePath 文件路径
 * @param startLine 起始行号
 * @param endLine 结束行号
 * @param newContent 新内容
 * @returns 是否成功
 */
export async function modifyFile(
  filePath: string,
  startLine: number,
  endLine: number,
  newContent: string
): Promise<boolean> {
  try {
    // 获取文件句柄
    const fileHandle = await getFileHandle(filePath);
    if (!fileHandle) {
      return false;
    }

    // 读取文件内容
    const file = await fileHandle.getFile();
    const fileContent = await file.text();
    const lines = fileContent.split("\n");

    // 强制成功策略：智能处理所有边界情况
    console.log(
      `原始请求: 修改文件 ${filePath}, 行号 ${startLine}-${endLine}, 文件当前行数: ${lines.length}`
    );

    // 1. 确保起始行至少为1
    let adjustedStartLine = Math.max(1, startLine);

    // 2. 如果需要的行数超过文件当前行数，扩展文件
    const requiredLines = Math.max(endLine, adjustedStartLine);
    while (lines.length < requiredLines) {
      lines.push("");
    }

    // 3. 设置调整后的结束行（现在文件已经足够长了）
    let adjustedEndLine = endLine;

    // 4. 确保起始行不大于结束行
    if (adjustedStartLine > adjustedEndLine) {
      // 如果起始行大于结束行，将结束行设为起始行
      adjustedEndLine = adjustedStartLine;
    }

    // 5. 最终验证：确保所有行号都在有效范围内
    adjustedStartLine = Math.max(1, Math.min(adjustedStartLine, lines.length));
    adjustedEndLine = Math.max(
      adjustedStartLine,
      Math.min(adjustedEndLine, lines.length)
    );

    console.log(
      `智能调整完成: ${startLine}-${endLine} -> ${adjustedStartLine}-${adjustedEndLine}, 文件行数: ${lines.length}`
    );

    // 替换指定行的内容，使用调整后的行号
    // 额外安全检查：确保slice操作的参数都是有效的
    const safeStartIndex = Math.max(0, adjustedStartLine - 1);
    const safeEndIndex = Math.min(lines.length, adjustedEndLine);

    const newLines = [
      ...lines.slice(0, safeStartIndex),
      ...newContent.split("\n"),
      ...lines.slice(safeEndIndex),
    ];

    console.log(
      `安全切片: 前部分[0:${safeStartIndex}], 新内容, 后部分[${safeEndIndex}:]`
    );

    // 写入文件
    const writable = await fileHandle.createWritable();
    await writable.write(newLines.join("\n"));
    await writable.close();

    console.log(`✅ 文件修改成功: ${filePath}`);
    console.log(
      `📊 操作详情: 原始行号${startLine}-${endLine} -> 实际操作${adjustedStartLine}-${adjustedEndLine}`
    );
    console.log(`📄 文件状态: 修改后共${newLines.length}行`);
    return true;
  } catch (error) {
    console.error(`修改文件失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 删除文件
 * @param filePath 文件路径
 * @returns 是否成功
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    // 分割路径
    const pathParts = filePath
      .split(/[\/\\]/)
      .filter((part) => part.length > 0);

    // 如果没有路径部分，说明文件在根目录
    if (pathParts.length === 0) {
      console.error("无效的文件路径");
      return false;
    }

    // 获取文件名和父目录
    const fileName = pathParts.pop() as string;

    // 获取父目录句柄
    const directoryHandle = window.directoryHandle;
    if (!directoryHandle) {
      console.error("未找到目录句柄，请先选择项目文件夹");
      return false;
    }

    // 导航到包含文件的目录
    let parentDir = directoryHandle;
    for (const part of pathParts) {
      try {
        parentDir = await parentDir.getDirectoryHandle(part);
      } catch (error) {
        console.error(`找不到目录: ${part}`, error);
        return false;
      }
    }

    // 删除文件
    await parentDir.removeEntry(fileName);

    console.log(`成功删除文件: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`删除文件失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 创建文件
 * @param filePath 文件路径
 * @param content 文件内容
 * @returns 是否成功
 */
export async function createFile(
  filePath: string,
  content: string
): Promise<boolean> {
  try {
    // 分割路径
    const pathParts = filePath
      .split(/[\/\\]/)
      .filter((part) => part.length > 0);

    // 如果没有路径部分，说明文件在根目录
    if (pathParts.length === 0) {
      console.error("无效的文件路径");
      return false;
    }

    // 获取文件名（路径的最后一部分）
    const fileName = pathParts.pop() as string;

    // 获取或创建父目录
    const dirPath = pathParts.join("/");
    const parentDir = await createDirectory(dirPath);
    if (!parentDir) {
      return false;
    }

    // 检查文件是否已存在
    try {
      await parentDir.getFileHandle(fileName, { create: false });
      console.error(`文件已存在: ${filePath}`);
      return false;
    } catch (error) {
      // 文件不存在，可以继续创建
    }

    // 创建文件
    const fileHandle = await parentDir.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    console.log(`成功创建文件: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`创建文件失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 判断是否需要继续对话
 * @param response AI响应内容
 * @returns 是否继续
 */
export function shouldContinueDialog(response: string): boolean {
  // 检查响应中是否包含继续标记
  const continueRegex = /```continue\s+(true|false)\s*```/;
  const match = response.match(continueRegex);

  // 如果明确指示false，则返回false
  if (match && match[1] === "false") {
    return false;
  }

  // 默认返回true，除非明确指示不继续
  return true;
}

export async function searchGpt(
  keyword: string,
  onUpdate?: (chunk: string) => void
): Promise<string> {
  try {
    // 构建提示词
    const prompt = getLocalizedPrompt(
      `针对关键词 "${keyword}"，执行最大范围的实时搜索。将所有搜索结果整合提炼，并以结构清晰的 Markdown 文档格式输出。

文档要求：
1. 以"${keyword}"作为文档标题
2. 包含完整的背景信息和最新动态
3. 按主题或时间顺序组织内容，使用适当的Markdown标题层级
4. 提供全面且客观的信息总结
5. 如果是技术主题，包含关键概念解释和应用场景
6. 如果是新闻事件，包含事件起因、发展和影响
7. 结尾部分提供简明扼要的总结

请确保内容：
- 结构清晰，使用Markdown格式（标题、列表、引用等）
- 信息准确全面
- 观点客观中立
- 适合作为知识库参考资料`,

      `For the keyword "${keyword}", perform a comprehensive real-time search. Synthesize all search results and output in a well-structured Markdown document format.

Document requirements:
1. Use "${keyword}" as the document title
2. Include complete background information and latest developments
3. Organize content by topic or chronologically, using appropriate Markdown heading levels
4. Provide comprehensive and objective information summary
5. For technical topics, include key concept explanations and application scenarios
6. For news events, include causes, developments, and impacts
7. Provide a concise summary in the conclusion section

Please ensure the content is:
- Well-structured using Markdown format (headings, lists, quotes, etc.)
- Accurate and comprehensive
- Objective and neutral in perspective
- Suitable as a knowledge base reference`
    );

    // 调用API获取响应
    let response = "";

    await chatCompletion(
      [
        {
          role: "system",
          content: getLocalizedPrompt(
            "你是一个专业的研究助手，擅长整合和组织信息。你需要基于用户提供的关键词，生成一篇结构清晰、内容全面的Markdown格式文档。",
            "You are a professional research assistant skilled at integrating and organizing information. You need to generate a well-structured, comprehensive Markdown document based on the keyword provided by the user."
          ),
        },
        { role: "user", content: prompt },
      ],
      {
        model: "openai-large",
        stream: !!onUpdate,
        onUpdate: (chunk) => {
          response += chunk;
          if (onUpdate) {
            onUpdate(chunk);
          }
        },
      }
    );

    // 如果没有使用流式更新，则需要获取完整响应
    if (!onUpdate) {
      const result = await chatCompletion(
        [
          {
            role: "system",
            content: getLocalizedPrompt(
              "你是一个专业的研究助手，擅长整合和组织信息。你需要基于用户提供的关键词，生成一篇结构清晰、内容全面的Markdown格式文档。",
              "You are a professional research assistant skilled at integrating and organizing information. You need to generate a well-structured, comprehensive Markdown document based on the keyword provided by the user."
            ),
          },
          { role: "user", content: prompt },
        ],
        {
          model: "openai-large",
        }
      );

      response = result.choices[0].message.content;
    }

    return response;
  } catch (error) {
    console.error("搜索生成内容失败:", error);
    return getLocalizedPrompt(
      `# ${keyword}\n\n生成内容时发生错误，请重试。`,
      `# ${keyword}\n\nAn error occurred while generating content. Please try again.`
    );
  }
}
