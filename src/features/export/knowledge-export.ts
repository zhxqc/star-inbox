import type {
  GitHubRepository,
  UserRepositoryMetadata,
} from '../../domain/repository'

export interface KnowledgeExportEntry {
  repository: GitHubRepository
  metadata: UserRepositoryMetadata
}

function yamlString(value: string) {
  return JSON.stringify(value)
}

function text(value?: string, fallback = '尚未填写。') {
  return value?.trim() || fallback
}

function markdownHeading(value: string) {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^#+\s*/, '')
    .trim()
}

function markdownInline(value: string) {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function safeMarkdownFilename(entry: KnowledgeExportEntry) {
  const source = entry.metadata.customTitle || entry.repository.fullName
  const printable = [...source]
    .filter((character) => character.charCodeAt(0) > 31)
    .join('')
  const safe = printable
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 100)
  const stem = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)
    ? `repository-${entry.repository.githubId}-${safe}`
    : safe
  return `${stem || `repository-${entry.repository.githubId}`}.md`
}

export function buildRepositoryMarkdown(entry: KnowledgeExportEntry) {
  const { repository, metadata } = entry
  const title = markdownHeading(metadata.customTitle || repository.name)
  const tags = metadata.tags.map(yamlString).join(', ')
  return `---
github: ${yamlString(repository.htmlUrl)}
github_id: ${repository.githubId}
status: ${yamlString(metadata.lifecycleStatus)}
intent: ${yamlString(metadata.intent)}
tags: [${tags}]
starred_at: ${yamlString(repository.starredAt ?? '')}
last_verified_at: ${yamlString(metadata.lastVerifiedAt ?? '')}
private_repository: ${repository.private ? 'true' : 'false'}
---

# ${title}

## 一句话用途

${text(metadata.customSummary)}

## 为什么收藏

${text(metadata.whyStarred)}

## 适用场景

${text(metadata.useCases)}

## 替代方案

${text(metadata.alternatives)}

## 我的结论

${text(metadata.verificationSummary || metadata.note)}

## GitHub 信息

- 仓库：${repository.fullName}
- Description：${text(repository.description, '无')}
- 主语言：${repository.primaryLanguage ?? '未知'}
- License：${repository.licenseSpdx ?? '未知'}
- 最近推送：${repository.pushedAt ?? '未知'}
`
}

export function buildKnowledgeCollection(entries: KnowledgeExportEntry[]) {
  const generatedAt = new Date().toISOString()
  const sections = entries.map(
    (
      entry,
    ) => `## ${markdownHeading(entry.metadata.customTitle || entry.repository.fullName)}

${text(entry.metadata.customSummary)}

- GitHub: ${entry.repository.htmlUrl}
- Status: ${entry.metadata.lifecycleStatus}
- Intent: ${entry.metadata.intent}
- Tags: ${entry.metadata.tags.map(markdownInline).join(', ') || '无'}

### 我的结论

${text(entry.metadata.verificationSummary)}`,
  )
  return `# Star Inbox 精选项目

生成时间：${generatedAt}

项目数量：${entries.length}

${sections.join('\n\n---\n\n')}
`
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/markdown;charset=utf-8',
) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
