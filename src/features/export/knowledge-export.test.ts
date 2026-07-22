import { describe, expect, it } from 'vitest'
import { createRepositoryFixture } from '../../test/repository-fixture'
import {
  buildRepositoryMarkdown,
  safeMarkdownFilename,
} from './knowledge-export'

describe('knowledge export', () => {
  it('creates Obsidian-compatible frontmatter and a filesystem-safe name', () => {
    const entry = {
      repository: createRepositoryFixture(),
      metadata: {
        repositoryId: 42,
        intent: 'using' as const,
        lifecycleStatus: 'verified' as const,
        customTitle: 'Agent: local/tool?',
        customSummary: '本地 Agent',
        verificationSummary: '适合日常使用。',
        tags: ['AI', 'local-first'],
        lastVerifiedAt: '2026-07-22T00:00:00.000Z',
      },
    }

    expect(safeMarkdownFilename(entry)).toBe('Agent- local-tool-.md')
    const markdown = buildRepositoryMarkdown(entry)
    expect(markdown).toContain('status: "verified"')
    expect(markdown).toContain('tags: ["AI", "local-first"]')
    expect(markdown).toContain('## 我的结论')
    expect(markdown).toContain('适合日常使用。')
  })

  it('keeps user titles and tags from breaking generated headings', () => {
    const entry = {
      repository: createRepositoryFixture(),
      metadata: {
        repositoryId: 42,
        intent: 'using' as const,
        lifecycleStatus: 'verified' as const,
        customTitle: '# Tool\n## injected heading',
        verificationSummary: 'verified',
        tags: ['AI\nunexpected'],
      },
    }

    const markdown = buildRepositoryMarkdown(entry)
    expect(markdown).toContain('# Tool ## injected heading')
    expect(markdown).not.toContain('\n## injected heading\n')
  })

  it('avoids Windows reserved filenames', () => {
    const entry = {
      repository: createRepositoryFixture(),
      metadata: {
        repositoryId: 42,
        intent: 'using' as const,
        lifecycleStatus: 'verified' as const,
        customTitle: 'CON',
        verificationSummary: 'verified',
        tags: [],
      },
    }

    expect(safeMarkdownFilename(entry)).toBe('repository-42-CON.md')
  })
})
