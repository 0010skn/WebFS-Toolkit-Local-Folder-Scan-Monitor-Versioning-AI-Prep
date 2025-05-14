# Folda-Scan - 本地文件夹扫描工具

Folda-Scan 是一个基于 Next.js 14 开发的网页应用，用于扫描和监控本地项目文件夹的变化。

## 功能特点

- **授权访问本地文件夹**：通过 File System Access API，允许用户选择一个本地项目文件夹，并授权 Web 应用对其进行只读访问。
- **.gitignore 规则应用**：读取并解析项目根目录下的.gitignore 文件，将其规则应用于文件扫描过程。
- **实时项目结构监控**：首次扫描后，定期重新扫描项目文件夹，检测文件系统中的变化。
- **差异化变动分析**：对比当前扫描结果与上一个快照，识别出具体的变动。对于内容发生修改的文本文件，生成文本差异(diff)。
- **生成并下载项目报告**：生成包含项目结构和变动详情的.txt 格式报告。

## 开始使用

首先，运行开发服务器：

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用方法

1. 点击"选择文件夹"按钮，授权访问本地项目文件夹。
2. 应用会自动扫描文件夹，并检测.gitignore 文件（如果存在）。
3. 扫描完成后，可以查看项目结构。
4. 应用会定期检测文件变动，并在变动发生时更新显示。
5. 点击"生成报告"按钮，可以下载项目报告。

## 技术实现

- Next.js 14 App Router
- File System Access API
- .gitignore 解析和应用
- 文件差异(diff)生成
- Tailwind CSS 响应式设计

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
