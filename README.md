<!-- GitHub Badges -->
<p align="center">
  <a href="https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/stargazers"><img src="https://img.shields.io/github/stars/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/network/members"><img src="https://img.shields.io/github/forks/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep?style=social" alt="GitHub forks"></a>
  <a href="https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/issues"><img src="https://img.shields.io/github/issues/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep" alt="GitHub issues"></a>
  <a href="https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/blob/main/LICENSE"><img src="https://img.shields.io/github/license/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep" alt="GitHub license"></a>
</p>

<p align="center">
  <a href="https://github.com/0010skn/WebFS-Toolkit-Local-Folder-Scan-Monitor-Versioning-AI-Prep/blob/main/preview.md">
    <img src="https://img.shields.io/badge/Preview-Click%20Here-blue" alt="Preview">
  </a>
</p>

# 📂 Folda-Scan

**Your Modern Local File Companion in the Browser! 🚀**

Folda-Scan leverages the File System Access API to bring powerful local folder exploration, real-time monitoring, and simple version control directly to your web browser. No installation needed!

---

## ✨ Features

- 📁 **Browse Local Folders:** Securely access and navigate your local project directories.
- 👁️ **Real-time Monitoring:** Keep an eye on file changes as they happen.
  - 🆕 **FileSystemObserver Support:** Uses the experimental FileSystemObserver API when available for efficient, event-driven file change detection without polling.
  - **Smart Fallback:** Automatically falls back to interval polling when the FileSystemObserver is not supported by the browser.
- 📜 **.gitignore Aware:** Respects your project's ignore rules for cleaner scans and backups.
- ⏱️ **Simple Version Management:** Easily create backups of your project's current state and restore to previous versions. All stored locally in a `.fe` folder.
- 🤖 **AI-Ready Reports:** Generate Markdown reports of your project structure, file contents, and changes – perfect for feeding to AI assistants or for documentation.
- 🧠 **Semantic Vectorization Engine:** Transform your project into an optimized knowledge graph through advanced semantic analysis and vector embedding technology.
  - **Natural Language Queries:** Interact with your codebase using natural language to locate relevant files and code sections.
  - **Intelligent Resource Identification:** Proprietary algorithms identify the most semantically relevant resources based on your query intent.
  - **Content-Aware Matching:** Optional deep content analysis for enhanced precision in complex codebases.
  - **Token Optimization:** Sophisticated filtering reduces token consumption by orders of magnitude when working with large language models.
  - **Markdown-Ready Output:** Generates structured, context-rich output optimized for AI assistants and documentation.
- 🗂️ **View Project Structure, Changes, and File Content** directly in the app.

---

## 🛠️ Built With

- Next.js 14
- File System Access API
- FileSystemObserver API (with fallback for unsupported browsers)
- Advanced Semantic Vector Analysis

Ideal for developers, designers, and anyone needing a quick, lightweight tool for local project management without the overhead of complex setups.

---

## 🌍 Open Source & Privacy

Open source and privacy-focused – all operations happen locally in your browser.

---

---

<!-- Chinese Version -->

<p align="center">
  <!-- You can repeat badges or simply point to the project -->
  <strong><a href="#-folda-scan">[English Version / 英文版]</a></strong>
</p>

# 📂 折尔达-扫 (Folda-Scan)

**浏览器里头你个现代本地文件好帮手！🚀**

折尔达-扫使唤着文件系统访问 API，给你带来强大本地文件夹探查，实时监控，简单版本管理，直接整到浏览器里头来。不用装啥软件！

---

## ✨ 主要功能

- 📁 **翻腾本地文件夹：** 贴实儿地进到并溜达你个本地项目文件夹。
- 👁️ **现挂儿监控：** 盯着文件变化，一有动静就看见。
  - 🆕 **文件系统观察器支持：** 在支持的浏览器上使用实验性的 FileSystemObserver API，通过事件驱动方式高效检测文件变化，不再需要轮询。
  - **智能回退：** 当浏览器不支持 FileSystemObserver 时，自动回退到定时轮询方式。
- 📜 **.gitignore 知道：** 尊重你项目里头的忽略规则，扫得干净，备份利索。
- ⏱️ **简单版本管理：** 轻轻松松备份项目当前状态，想回哪个版本就回哪个版本。都保存在本地一个 `.fe` 文件夹里头。
- 🤖 **AI 准备好了报告：** 生成项目结构、文件内容、变化情况的 Markdown 报告，给 AI 助手喂食或者做文档正好。
- 🧠 **语义向量化引擎：** 通过先进的语义分析和向量嵌入技术，将您的项目转化为优化的知识图谱。
  - **自然语言查询：** 使用自然语言与代码库交互，精准定位相关文件和代码段。
  - **智能资源识别：** 专有算法基于查询意图识别语义上最相关的资源。
  - **内容感知匹配：** 可选的深度内容分析，为复杂代码库提供增强精度。
  - **Token 优化：** 先进的过滤机制在与大型语言模型协作时，将 token 消耗降低数量级。
  - **Markdown 就绪输出：** 生成结构化、上下文丰富的输出，为 AI 助手和文档编制优化。
- 🗂️ **注意啊这不是分布式的**

---

## 🛠️ 技术栈

- Next.js 14
- 文件系统访问 API (File System Access API)
- 文件系统观察器 API (FileSystemObserver API)（不支持的浏览器会自动回退）
- 高级语义向量分析技术

对开发者、设计师还有那些需要快速、轻量级工具管理本地项目的人来说，是理想选择。别提那些复杂设置啦，累死个人。

---

## 🌍 开源与隐私

开源又注重隐私——所有操作都在你浏览器里本地完成。
