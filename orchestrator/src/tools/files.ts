import fs from 'node:fs'
import path from 'node:path'
import { REPO_PATH } from '../config.js'

const resolve = (filePath: string): string => path.resolve(REPO_PATH, filePath)

export const readFile = (filePath: string): string =>
  fs.readFileSync(resolve(filePath), 'utf-8')

export const writeFile = (filePath: string, content: string): string => {
  const abs = resolve(filePath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf-8')
  return `File written: ${filePath}`
}

export const listFiles = (dirPath: string): string => {
  const abs = resolve(dirPath)
  const entries = fs.readdirSync(abs, { withFileTypes: true })
  return entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n')
}
