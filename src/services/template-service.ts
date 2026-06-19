import * as bridge from './bridge'

const TEMPLATES_DIR = '.confucius/templates'

export const PRESET_TEMPLATES: Record<string, string> = {
  '日记.md': `---
title: {{date}} 日记
date: {{date}}
tags: [日记]
---

# {{date}}

## 今日计划

- [ ] 

## 今日记录

## 反思
`,
  '会议记录.md': `---
title: 会议记录 - {{date}}
date: {{date}}
tags: [会议]
---

# 会议记录

**日期**：{{date}}
**参会人**：
**主题**：

## 讨论内容

## 决定事项

- [ ] 

## 待办事项

- [ ] 
`,
  '周报.md': `---
title: 周报 - {{date}}
date: {{date}}
tags: [周报]
---

# 周报（{{date}}）

## 本周完成

- 

## 遇到的问题

- 

## 下周计划

- 
`,
  '读书笔记.md': `---
title: 读书笔记 - {{title}}
date: {{date}}
tags: [读书笔记]
---

# {{title}}

**书名**：
**作者**：
**阅读日期**：{{date}}

## 摘录

> 

## 感悟

`,
}

export interface TemplateFile {
  name: string
  path: string
}

export async function listTemplates(workspacePath: string): Promise<TemplateFile[]> {
  const dirPath = `${workspacePath}/${TEMPLATES_DIR}`
  try {
    const entries = await bridge.readDir(dirPath)
    return entries
      .filter((e) => !e.is_directory && (e.name.endsWith('.md') || e.name.endsWith('.markdown')))
      .map((e) => ({ name: e.name, path: `${dirPath}/${e.name}` }))
  } catch {
    return []
  }
}

export async function readTemplateContent(templatePath: string): Promise<string> {
  try {
    const result = await bridge.readFile(templatePath)
    return result.content
  } catch {
    return ''
  }
}

export async function ensurePresetTemplates(workspacePath: string): Promise<void> {
  const dirPath = `${workspacePath}/${TEMPLATES_DIR}`
  try {
    await bridge.createDir(workspacePath, TEMPLATES_DIR)
  } catch { /* dir may already exist */ }

  for (const [name, content] of Object.entries(PRESET_TEMPLATES)) {
    const filePath = `${dirPath}/${name}`
    const exists = await bridge.fileExists(filePath)
    if (!exists) {
      await bridge.writeFile(filePath, content)
    }
  }
}

export function expandTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

export function getDefaultVariables(title: string): Record<string, string> {
  const now = new Date()
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
    title,
  }
}
