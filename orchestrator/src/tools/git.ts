import { execSync, exec } from 'node:child_process'
import { promisify } from 'node:util'
import { REPO_PATH, TEST_COMMAND } from '../config.js'

const execAsync = promisify(exec)
const GIT_OPTS = { cwd: REPO_PATH }

export const createBranch = (branchName: string): string => {
  execSync(`git checkout -b ${branchName}`, GIT_OPTS)
  return `Branch created and checked out: ${branchName}`
}

export const commitAndPush = (files: string[], message: string): string => {
  const fileArgs = files.map(f => `"${f}"`).join(' ')
  execSync(`git add ${fileArgs}`, GIT_OPTS)
  execSync(`git commit -m ${JSON.stringify(message)}`, GIT_OPTS)
  execSync('git push --set-upstream origin HEAD', GIT_OPTS)
  return `Committed and pushed: ${message}`
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
