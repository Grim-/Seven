import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { extractGuideSection, parseGuideMarkdown, resolveGuideMediaUrl, searchGuides } from '../src/renderer/src/guides/parser'

const PAGES_DIR = path.resolve('src/renderer/src/guides/pages')
const MEDIA_DIR = path.resolve('src/renderer/src/guides/media')

test('parseGuideMarkdown parses frontmatter, headings, tags, and strips duplicate H1', () => {
  const doc = parseGuideMarkdown(
    '10-demo',
    `---
title: Demo Guide
section: Start Here
order: 15
summary: Quick walkthrough.
tags: [alpha, beta]
---

# Demo Guide

## First Section

Some body text with **markdown**.

### Nested Step

More details.
`
  )
  assert.equal(doc.title, 'Demo Guide')
  assert.equal(doc.section, 'Start Here')
  assert.equal(doc.order, 15)
  assert.equal(doc.summary, 'Quick walkthrough.')
  assert.deepEqual(doc.tags, ['alpha', 'beta'])
  assert.equal(doc.headings.length, 2)
  assert.deepEqual(
    doc.headings.map((h) => ({ level: h.level, id: h.id })),
    [
      { level: 2, id: 'first-section' },
      { level: 3, id: 'nested-step' }
    ]
  )
  assert.ok(!doc.body.startsWith('# Demo Guide'))
})

test('resolveGuideMediaUrl resolves relative image and GIF paths cleanly', () => {
  const map = {
    'demo.gif': '/static/demo-123.gif',
    'shot.png': '/static/shot-456.png'
  }
  assert.equal(resolveGuideMediaUrl('../media/demo.gif', map), '/static/demo-123.gif')
  assert.equal(resolveGuideMediaUrl('./media/demo.gif', map), '/static/demo-123.gif')
  assert.equal(resolveGuideMediaUrl('media/shot.png', map), '/static/shot-456.png')
  assert.equal(resolveGuideMediaUrl('https://example.com/a.gif', map), 'https://example.com/a.gif')
})

test('all built-in markdown guides parse cleanly and reference valid media files', () => {
  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md')).sort()
  assert.ok(files.length >= 6, `Expected at least 6 built-in guides, found ${files.length}`)

  const mediaFiles = new Set(fs.readdirSync(MEDIA_DIR).map((f) => f.toLowerCase()))
  const docs = files.map((file) => {
    const raw = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8')
    return parseGuideMarkdown(file.replace(/\.md$/i, ''), raw, file)
  })

  for (const doc of docs) {
    assert.ok(doc.title.length > 0, `${doc.sourceFile} missing title`)
    assert.ok(doc.section.length > 0, `${doc.sourceFile} missing section`)
    assert.ok(doc.body.length > 40, `${doc.sourceFile} body too short`)
    const outsideFences = doc.body.replace(/```[\s\S]*?```/g, '')
    for (const m of outsideFences.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const ref = m[1].trim()
      if (/^https?:/i.test(ref)) continue
      const base = ref.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
      assert.ok(mediaFiles.has(base), `${doc.sourceFile} references missing media "${ref}"`)
    }
  }

  const hits = searchGuides(docs, 'openrouter')
  assert.ok(hits.length >= 1)
  assert.ok(hits.some((h) => h.guide.slug.includes('image') || h.guide.slug.includes('models')))
})

test('extractGuideSection extracts exact section markdown including nested subsections', () => {
  const sample = `## Alpha

Intro text.

### Alpha Sub

\`\`\`markdown
## Not a real heading
\`\`\`

Sub details.

## Beta

Other section.`

  const alpha = extractGuideSection(sample, 'alpha')
  assert.ok(alpha)
  assert.ok(alpha.startsWith('## Alpha'))
  assert.ok(alpha.includes('### Alpha Sub'))
  assert.ok(alpha.includes('## Not a real heading'))
  assert.ok(!alpha.includes('## Beta'))

  const sub = extractGuideSection(sample, 'alpha-sub')
  assert.ok(sub)
  assert.ok(sub.startsWith('### Alpha Sub'))
  assert.ok(sub.includes('Sub details.'))
  assert.ok(!sub.includes('## Beta'))
})
