import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['src/engine', 'src/modules']

const ALLOWED = new Set([
  'src/engine/util/fs.ts',
  'src/engine/vault.ts',
  'src/engine/vision.ts',
  'src/engine/tts.ts',
  'src/engine/python/scripts.ts',
  'src/engine/model/zip.ts',
  'src/engine/model/server/install.ts',
  'src/engine/model/downloads.ts',
  'src/engine/modules/mcp.ts',
  'src/engine/modules/registry.ts',
  'src/engine/skills.ts'
])

const OPS = 'writeFile|appendFile|rename|rm|unlink|rmdir|cp|copyFile|truncate|createWriteStream'
const CALL = new RegExp(`\\b(?:fs|fsp|promises)\\.(?:${OPS})(?:Sync)?\\s*\\(`)
const NAMED = new RegExp(`import\\s*\\{[^}]*\\b(?:${OPS})(?:Sync)?\\b[^}]*\\}\\s*from\\s*['"](?:node:)?fs(?:/promises)?['"]`)

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js)$/.test(entry.name)) out.push(full)
  }
}

const files: string[] = []
for (const root of ROOTS) walk(root, files)

const problems: string[] = []
for (const file of files) {
  const rel = file.split(path.sep).join('/')
  if (ALLOWED.has(rel)) continue
  const text = fs.readFileSync(file, 'utf8')
  if (NAMED.test(text)) problems.push(`${rel}: imports a file-changing function from fs`)
  text.split('\n').forEach((line, i) => {
    if (CALL.test(line)) problems.push(`${rel}:${i + 1}: ${line.trim()}`)
  })
}

if (problems.length) {
  console.error('Data files must be changed through src/engine/util/fs.ts (writeJson, writeText, writeBytes, appendLine, writeLines, removePath, renamePath, copyPath, writeUserFile), not fs directly:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`Storage check passed (${files.length} files).`)
