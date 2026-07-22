import { z } from 'zod'

const nullableString = z.string().nullable().optional()
const githubRepositoryUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com'
  }, 'Expected an HTTPS github.com repository URL')

export const githubOwnerSchema = z.object({
  login: z.string(),
  avatar_url: z.string().url().nullable().optional(),
})

export const githubLicenseSchema = z
  .object({
    spdx_id: z.string().nullable().optional(),
  })
  .nullable()
  .optional()

export const githubRepositorySchema = z.object({
  id: z.number().int().nonnegative(),
  node_id: z.string(),
  name: z.string(),
  full_name: z.string(),
  owner: githubOwnerSchema,
  html_url: githubRepositoryUrl,
  description: nullableString,
  homepage: nullableString,
  topics: z.array(z.string()).default([]),
  language: nullableString,
  license: githubLicenseSchema,
  fork: z.boolean(),
  is_template: z.boolean().optional().default(false),
  default_branch: nullableString,
  created_at: nullableString,
  updated_at: nullableString,
  pushed_at: nullableString,
  archived: z.boolean().default(false),
  disabled: z.boolean().default(false),
  private: z.boolean().default(false),
  visibility: nullableString,
  stargazers_count: z.number().int().nonnegative().default(0),
  forks_count: z.number().int().nonnegative().default(0),
  open_issues_count: z.number().int().nonnegative().default(0),
  size: z.number().int().nonnegative().default(0),
})

export const starredRepositorySchema = z.object({
  starred_at: z.string().nullable().optional(),
  repo: githubRepositorySchema,
})

export const starredRepositoriesPageSchema = z.array(starredRepositorySchema)

export const authenticatedUserSchema = z.object({
  id: z.number().int().nonnegative(),
  login: z.string(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().url(),
})

export type GitHubRepositoryResponse = z.infer<typeof githubRepositorySchema>
export type StarredRepositoryResponse = z.infer<typeof starredRepositorySchema>
