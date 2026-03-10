import fs from 'node:fs'
import path from 'node:path'
import { registerTool } from './index.js'

registerTool({
  name: 'read_file',
  description: 'Read a file from the repository. Path is relative to the repo root.',
  inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  async execute({ path: filePath }: { path: string }, { repoPath }) {
    const abs = path.resolve(repoPath, filePath)
    try {
      return fs.readFileSync(abs, 'utf-8')
    } catch {
      return `(file not found: ${filePath})`
    }
  },
})

registerTool({
  name: 'write_file',
  description: 'Write content to a file in the repository. Creates parent directories if needed.',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
  },
  async execute({ path: filePath, content }: { path: string; content: string }, { repoPath }) {
    const abs = path.resolve(repoPath, filePath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf-8')
    return `Written: ${filePath}`
  },
})

registerTool({
  name: 'list_files',
  description: 'List files in a directory. Path is relative to the repo root.',
  inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  async execute({ path: dirPath }: { path: string }, { repoPath }) {
    const abs = path.resolve(repoPath, dirPath)
    try {
      const entries = fs.readdirSync(abs, { withFileTypes: true })
      return entries.map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n')
    } catch {
      return `(directory not found: ${dirPath})`
    }
  },
})
