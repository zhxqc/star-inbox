import { expect, test } from '@playwright/test'

test('landing leads to the private import flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /你的 Stars/ })).toBeVisible()
  await page.getByRole('link', { name: '开始整理我的 GitHub Stars' }).click()
  await expect(
    page.getByRole('heading', { name: '把 Stars 带回你的浏览器。' }),
  ).toBeVisible()
  await expect(page.getByLabel('GitHub Personal Access Token')).toHaveAttribute(
    'autocomplete',
    'off',
  )
  await expect(page.getByLabel('GitHub Personal Access Token')).toHaveAttribute(
    'data-1p-ignore',
    'true',
  )
  const createTokenLink = page.getByRole('link', {
    name: /一键打开创建页面/,
  })
  await expect(createTokenLink).toHaveAttribute('target', '_blank')
  await expect(createTokenLink).toHaveAttribute('href', /starring=read/)
  await expect(
    page.getByText('Account permissions → Starring → Read-only。'),
  ).toBeAttached()
})

test('footer stays at the viewport bottom on a short page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: '收件箱还是空的' }),
  ).toBeVisible()

  const layout = await page.locator('footer').evaluate((footer) => ({
    footerBottom: footer.getBoundingClientRect().bottom,
    viewportBottom: window.innerHeight,
  }))
  expect(
    Math.abs(layout.footerBottom - layout.viewportBottom),
  ).toBeLessThanOrEqual(1)
})

test('imported stars can be reviewed and remain available after refresh', async ({
  page,
}) => {
  test.slow()
  await page.route('https://api.github.com/user', async (route) => {
    await route.fulfill({
      json: {
        id: 7,
        login: 'reviewer',
        name: 'Review User',
        avatar_url: 'https://avatars.githubusercontent.com/u/7?v=4',
      },
    })
  })
  await page.route(
    /https:\/\/api\.github\.com\/user\/starred.*/,
    async (route) => {
      await route.fulfill({
        json: [
          {
            starred_at: '2026-07-01T12:00:00Z',
            repo: {
              id: 42,
              node_id: 'R_kgDOExample',
              name: 'star-inbox',
              full_name: 'example/star-inbox',
              owner: {
                login: 'example',
                avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
              },
              html_url: 'https://github.com/example/star-inbox',
              description: 'Review GitHub stars locally.',
              homepage: null,
              topics: ['local-first', 'github'],
              language: 'TypeScript',
              license: { spdx_id: 'MIT' },
              fork: false,
              is_template: false,
              default_branch: 'main',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-07-20T00:00:00Z',
              pushed_at: '2026-07-19T00:00:00Z',
              archived: false,
              disabled: false,
              private: false,
              visibility: 'public',
              stargazers_count: 120,
              forks_count: 12,
              open_issues_count: 3,
              size: 2048,
            },
          },
          {
            starred_at: '2022-03-01T12:00:00Z',
            repo: {
              id: 41,
              node_id: 'R_kgDOLegacy',
              name: 'legacy-tool',
              full_name: 'example/legacy-tool',
              owner: {
                login: 'example',
                avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
              },
              html_url: 'https://github.com/example/legacy-tool',
              description: 'An archived legacy developer tool.',
              homepage: null,
              topics: ['developer-tools', 'legacy'],
              language: 'TypeScript',
              license: { spdx_id: 'MIT' },
              fork: false,
              is_template: false,
              default_branch: 'main',
              created_at: '2020-01-01T00:00:00Z',
              updated_at: '2022-04-01T00:00:00Z',
              pushed_at: '2022-04-01T00:00:00Z',
              archived: true,
              disabled: false,
              private: false,
              visibility: 'public',
              stargazers_count: 80,
              forks_count: 5,
              open_issues_count: 0,
              size: 512,
            },
          },
        ],
      })
    },
  )
  await page.route(
    'https://api.github.com/repos/example/star-inbox/readme',
    async (route) => {
      await route.fulfill({
        contentType: 'text/plain',
        body: '# Star Inbox\n\nA local-first workflow for reviewing GitHub Stars.',
      })
    },
  )
  await page.route(
    'https://api.github.com/user/starred/example/legacy-tool',
    async (route) => {
      expect(route.request().method()).toBe('DELETE')
      await route.fulfill({ status: 204 })
    },
  )

  await page.goto('/import')
  await page
    .getByLabel('GitHub Personal Access Token')
    .fill('test-token-not-a-secret')
  await page.getByRole('button', { name: /验证只读连接/ }).click()
  await expect(page.getByText('Token 验证成功')).toBeVisible()
  await page.getByRole('button', { name: /开始导入全部 Stars/ }).click()

  await expect(page.getByRole('heading', { name: 'Stars 总览' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '先处理问题，不先整理文件夹' }),
  ).toBeVisible()

  await page.getByRole('link', { name: '整理' }).click()
  await expect(
    page.getByRole('heading', { name: '不逐个打标签，按问题批量决定' }),
  ).toBeVisible()
  await page.getByLabel('选择 example/legacy-tool').check()
  await page.getByRole('button', { name: /确认并加入清理计划/ }).click()
  await expect(page.getByText(/加入 Action Center/)).toBeVisible()
  await page.getByRole('link', { name: /打开 Action Center/ }).click()
  await expect(
    page.getByRole('link', { name: /最小写权限 Token 页面/ }),
  ).toHaveAttribute('href', /starring=write/)
  await expect(page.getByLabel('Fine-grained Token')).toHaveAttribute(
    'autocomplete',
    'off',
  )
  await page.getByRole('button', { name: /选择全部等待项/ }).click()
  await page.getByLabel(/主动开启 GitHub 写入模式/).check()
  await page.getByLabel('输入 EXECUTE 确认').fill('EXECUTE')
  await page.getByRole('button', { name: /执行 1 个 GitHub 操作/ }).click()
  await expect(page.getByText('本次完成 1 个操作。')).toBeVisible()
  await expect(page.getByText('执行成功').first()).toBeVisible()

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: '全部 Stars' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'example/star-inbox' }),
  ).toBeVisible()
  await expect(page.getByLabel('每页')).toHaveValue('20')
  await page.getByLabel('每页').selectOption('50')
  await expect(page.getByLabel('每页')).toHaveValue('50')
  await expect
    .poll(() =>
      page
        .locator('.library-table thead')
        .evaluate((element) => getComputedStyle(element).position),
    )
    .toBe('sticky')

  await page.getByLabel('选择 example/star-inbox').check()
  await page.getByLabel('收藏意图').selectOption('reference')
  await page.getByRole('button', { name: /应用到所选/ }).click()
  await expect(page.getByText('已更新 1 个项目。')).toBeVisible()
  await page.getByRole('button', { name: 'example/star-inbox' }).click()
  const detailDialog = page.getByRole('dialog', {
    name: 'example/star-inbox',
  })
  await expect(detailDialog).toBeVisible()
  await expect
    .poll(() =>
      detailDialog.evaluate((dialog) => {
        const content = dialog.querySelector<HTMLElement>(
          '.repository-dialog-content',
        )
        const bounds = dialog.getBoundingClientRect()
        return {
          top: Math.round(bounds.top),
          bottomGap: Math.round(window.innerHeight - bounds.bottom),
          scrollTop: content?.scrollTop,
        }
      }),
    )
    .toEqual({
      top: 0,
      bottomGap: 0,
      scrollTop: 0,
    })
  await expect(
    detailDialog.getByRole('button', { name: '关闭详情' }),
  ).toBeFocused()
  await detailDialog.getByLabel('一句话用途').fill('本地 Stars 回顾工作台')
  await detailDialog.getByRole('button', { name: /保存单项设置/ }).click()
  await expect(detailDialog.getByText('本地整理结果已保存。')).toBeVisible()
  await detailDialog.getByRole('button', { name: /加载 README/ }).click()
  await expect(detailDialog.getByText('A local-first workflow')).toBeVisible()
  await detailDialog.getByRole('button', { name: '关闭详情' }).click()

  await page.getByRole('link', { name: /开始回顾/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Review Queue' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'example/star-inbox' }),
  ).toBeVisible()

  await page.getByRole('button', { name: /准备试用/ }).click()
  await page.getByLabel('一句话用途').fill('本地回顾 GitHub Stars')
  await page.getByLabel('为什么收藏').fill('准备验证本地优先工作流')
  await page.getByLabel('标签').fill('Local-first, GitHub')
  await page.getByLabel('私人备注').fill('回顾结果只留在浏览器')
  await page.getByRole('button', { name: /保存并下一个/ }).click()

  await expect(
    page.getByRole('heading', { name: 'Inbox 清空了' }),
  ).toBeVisible()
  await page.getByRole('link', { name: /^已回顾/ }).click()
  await page.reload()

  await expect(
    page.getByRole('heading', { name: 'example/star-inbox' }),
  ).toBeVisible()
  await expect(page.getByLabel('一句话用途')).toHaveValue(
    '本地回顾 GitHub Stars',
  )
  await expect(page.getByLabel('私人备注')).toHaveValue('回顾结果只留在浏览器')

  await page.getByRole('link', { name: '搜索' }).click()
  await page.getByLabel('描述你想找的项目').fill('本地 GitHub TypeScript 工具')
  await page.getByRole('button', { name: /搜索我的 Stars/ }).click()
  await expect(
    page.getByRole('heading', { name: 'example/star-inbox' }),
  ).toBeVisible()
  await page
    .locator('.ask-result-card')
    .filter({ hasText: 'example/star-inbox' })
    .getByRole('button', { name: '准备验证' })
    .click()
  await expect(page.getByText(/已加入准备验证/)).toBeVisible()

  await page.getByRole('link', { name: '知识' }).click()
  await expect(
    page.getByRole('heading', { name: '只整理真正准备使用的项目' }),
  ).toBeVisible()
  await page.getByLabel('我的结论（必填）').fill('已完成本地流程验证。')
  await page.getByRole('button', { name: /保存并标记已验证/ }).click()
  await expect(page.getByText('验证结论已保存在当前浏览器。')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 Obsidian 笔记/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('example-star-inbox')

  await page.goto('/gems')
  await expect(
    page.getByRole('heading', { name: '旧收藏里，今天值得重新看什么？' }),
  ).toBeVisible()
})
