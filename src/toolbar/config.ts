/**
 * 工具栏按钮配置（SVG 采用 24x24 stroke 图标，lucide 风格）
 */

/** @typedef {{id: 'sep'} | {id: string, title: string, icon?: string, label?: string, shortcut?: string}} ToolbarItem */

export const ICONS = {
  bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9M14 20H5M15 4L9 20',
  strike: 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  quote: 'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z',
  ul: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  ol: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  cl: 'm3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8',
  codeBlock: 'M10 8l-4 4 4 4M14 8l4 4-4 4',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  table: 'M12 3v18M3 9h18M3 15h18M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  hr: 'M3 12h18',
  undo: 'M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
  redo: 'M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13',
}

/** @type {ToolbarItem[]} */
export const toolbarItems = [
  { id: 'undo', title: '撤销 (Ctrl+Z)', icon: ICONS.undo },
  { id: 'redo', title: '重做 (Ctrl+Shift+Z)', icon: ICONS.redo },
  { id: 'sep' },
  { id: 'h1', title: '标题 1', label: 'H1' },
  { id: 'h2', title: '标题 2', label: 'H2' },
  { id: 'h3', title: '标题 3', label: 'H3' },
  { id: 'sep' },
  { id: 'bold', title: '加粗 (Ctrl+B)', icon: ICONS.bold },
  { id: 'italic', title: '斜体 (Ctrl+I)', icon: ICONS.italic },
  { id: 'strike', title: '删除线 (Ctrl+Shift+X)', icon: ICONS.strike },
  { id: 'code', title: '行内代码 (Ctrl+E)', icon: ICONS.code },
  { id: 'link', title: '链接 (Ctrl+K)', icon: ICONS.link },
  { id: 'sep' },
  { id: 'bulletList', title: '无序列表', icon: ICONS.ul },
  { id: 'orderedList', title: '有序列表', icon: ICONS.ol },
  { id: 'taskListToggle', title: '任务清单', icon: ICONS.cl },
  { id: 'blockquote', title: '引用', icon: ICONS.quote },
  { id: 'codeBlock', title: '代码块', icon: ICONS.codeBlock },
  { id: 'insertTable', title: '表格', icon: ICONS.table },
  { id: 'hr', title: '分隔线', icon: ICONS.hr },
  { id: 'sep' },
  { id: 'insertImage', title: '图片', icon: ICONS.image },
]
