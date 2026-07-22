# Star Inbox

[简体中文](README.md) · [English](README.en.md)

> GitHub Star 是收件箱，不是知识库。

Star Inbox 是一个零安装、本地优先的 GitHub Stars 决策工具。它把大量 Stars 压缩成少量可解释、可批量确认的决定，帮助你清理、搜索、重新发现，并沉淀真正验证过的项目。

- 无需产品账号
- 不使用 GitHub OAuth
- 不依赖业务后端
- Token 只存在当前页面内存
- 数据保存在你的浏览器
- GitHub 默认只读；远程 Star/Unstar 仅在显式 Action Mode 中执行
- 系统建议永远不会覆盖用户决定

## 当前进度

当前实现已经形成从导入到知识导出的完整本地闭环：

- React、TypeScript、Vite、React Router、Tailwind CSS
- 版本化 Dexie / IndexedDB 数据库
- 内存 Token 会话、只读导入与显式读写 Action Mode
- GitHub Stars 分页导入、进度、取消、自动重试与失败页续传
- GitHub 响应 Zod 校验、字段标准化、GitHub repository id 去重
- Landing、Import、Privacy、Dashboard 与 Review Queue
- 待回顾 / 已回顾视图、收藏意图、标签、收藏原因、用途和私人备注
- “保存并下一个”流程；回顾结果刷新后仍保存在 IndexedDB
- Dashboard 全量 Stars 表格、20/50/100 条分页、吸顶表头与当前页批量分类
- 单项目详情编辑，以及用户主动触发的按需 README 预览
- Smart Triage：可解释规则、五类处理队列、批量确认和清理计划
- Action Center：Dry Run、二次确认、批量 Star/Unstar、进度、取消、重试和安全记录
- Ask My Stars：本地任务搜索、候选对比、按需 README 增强和准备验证
- Forgotten Gems：基于收藏时间、推送时间和验证状态的每日旧项目候选
- Knowledge Export：验证结论、单项目 Obsidian Markdown 和已验证项目合集
- Fine-grained Token 快捷创建入口和可视化文字教程
- Vitest、Testing Library 与 Playwright 自动化测试

应用不会批量读取 README，也不会读取 Release、Issue、Commit 或仓库源码。只有用户在单项目详情或 Ask My Stars 候选中点击后，才会按需读取该项目的 README；内容仅保存在当前页面内存。应用不会创建业务后端。

导入、规则分析和本地“已放弃”状态永远不会自动修改 GitHub。只有用户在 Action Center 看到完整计划、选择操作、输入写权限 Token、主动开启 Action Mode 并输入确认词后，应用才调用 GitHub 官方 Star/Unstar API。

GitHub 的 Star Lists 仍处于公开预览，官方 REST/GraphQL API 没有提供创建 List 或写入 List 的受支持接口。因此 Star Inbox 不调用私有接口，也不会通过 Token 自动修改 GitHub Lists。

## 快速开始

环境要求：Node.js 20.19+ 或 22.12+。

```bash
npm ci
npm run dev
```

浏览器访问终端显示的本地地址，通常为 `http://localhost:5173`。

## 质量检查

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

首次运行端到端测试前安装 Chromium：

```bash
npx playwright install chromium
npm run test:e2e
```

## 隐私边界

Token 只由当前 React 会话持有。它不会进入 `localStorage`、`sessionStorage`、IndexedDB、URL、日志、错误信息或导出文件。刷新或关闭页面后 Token 消失。

Stars、整理数据、规则建议和行动记录保存在当前浏览器的 IndexedDB。Token、README 原文和确认词不会持久化。清理浏览器站点数据可能导致本地内容丢失。

## 项目结构

```text
src/
├── app/          # 路由与 Provider
├── components/   # 通用界面组件
├── pages/        # 页面入口
├── features/     # 导入、整理、行动、搜索、Gems、验证与导出流程
├── github/       # GitHub API、Schema、分页和标准化
├── db/           # Dexie Schema 与数据访问
├── domain/       # 领域模型
└── security/     # Token 内存会话
```

## 文档

- [架构说明](docs/architecture.md)
- [隐私与安全边界](docs/privacy.md)
- [数据模型](docs/data-model.md)
- [Agent 开发约束](AGENTS.md)

## English documentation

For the complete English README, see [README.en.md](README.en.md).
