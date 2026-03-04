import { execSync, exec } from 'node:child_process'
import { promisify } from 'node:util'
import { REPO_PATH, TEST_COMMAND } from '../config.js'

const execAsync = promisify(exec)
const GIT_OPTS = { cwd: REPO_PATH }

export const getCurrentBranch = (): string =>
  execSync('git rev-parse --abbrev-ref HEAD', GIT_OPTS).toString().trim()

export const createBranch = (branchName: string): string => {
  execSync('git fetch origin main', GIT_OPTS)
  execSync('git checkout -B main origin/main', GIT_OPTS)
  execSync(`git checkout -b ${branchName}`, GIT_OPTS)
  return `Branch created and checked out: ${branchName}`
}

export const checkoutBranch = (branchName: string): string => {
  execSync(`git fetch origin ${branchName}`, GIT_OPTS)
  execSync(`git checkout ${branchName}`, GIT_OPTS)
  return `Checked out branch: ${branchName}`
}

export const commitAndPush = (files: string[], message: string): string => {
  const current = getCurrentBranch()
  if (current === 'main') {
    throw new Error('Refusing to commit directly to main. Call git_create_branch or git_checkout_branch first.')
  }
  const fileArgs = files.map(f => `"${f}"`).join(' ')
  execSync(`git add ${fileArgs}`, GIT_OPTS)
  execSync(`git commit -m ${JSON.stringify(message)}`, GIT_OPTS)
  execSync('git push --set-upstream origin HEAD', GIT_OPTS)
  return `Committed and pushed to ${current}: ${message}`
}

export const runTests = async (command: string = TEST_COMMAND): Promise<string> => {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: REPO_PATH })
    return `Test output:\n${stdout}${stderr ? `\nStderr:\n${stderr}` : ''}`
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return `Tests failed:\n${e.stdout ?? ''}${e.stderr ? `\nStderr:\n${e.stderr}` : ''}\n${e.message ?? ''}`
  }
}
