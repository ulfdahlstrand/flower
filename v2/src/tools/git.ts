import { execSync } from 'node:child_process'
import { registerTool } from './index.js'

const git = (repoPath: string, args: string): string => {
  try {
    return execSync(`git -C "${repoPath}" ${args}`, { encoding: 'utf-8' }).trim()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`git ${args.split(' ')[0]}: ${msg}`)
  }
}

registerTool({
  name: 'git_create_branch',
  description: 'Create and checkout a new branch. Use naming pattern: task/{issue-id}-short-description',
  inputSchema: { type: 'object', properties: { branch_name: { type: 'string' } }, required: ['branch_name'] },
  async execute({ branch_name }: { branch_name: string }, { repoPath }) {
    git(repoPath, `checkout -b ${branch_name}`)
    return `Created and checked out branch: ${branch_name}`
  },
})

registerTool({
  name: 'git_checkout_branch',
  description: 'Checkout an existing branch.',
  inputSchema: { type: 'object', properties: { branch_name: { type: 'string' } }, required: ['branch_name'] },
  async execute({ branch_name }: { branch_name: string }, { repoPath }) {
    git(repoPath, `checkout ${branch_name}`)
    return `Checked out branch: ${branch_name}`
  },
})

registerTool({
  name: 'git_commit_and_push',
  description: 'Stage all changes, commit with a message, and push to origin.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      files: { type: 'array', items: { type: 'string' }, description: 'Specific files to stage. Omit to stage all changes.' },
    },
    required: ['message'],
  },
  async execute({ message, files }: { message: string; files?: string[] }, { repoPath }) {
    const toStage = files?.length ? files.join(' ') : '-A'
    git(repoPath, `add ${toStage}`)
    git(repoPath, `commit -m ${JSON.stringify(message)}`)
    const branch = git(repoPath, 'rev-parse --abbrev-ref HEAD')
    git(repoPath, `push -u origin ${branch}`)
    return `Committed and pushed to ${branch}`
  },
})

registerTool({
  name: 'git_current_branch',
  description: 'Get the name of the currently checked-out branch.',
  inputSchema: { type: 'object', properties: {} },
  async execute(_input, { repoPath }) {
    return git(repoPath, 'rev-parse --abbrev-ref HEAD')
  },
})
