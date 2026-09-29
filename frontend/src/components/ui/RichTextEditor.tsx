import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Bold, List, ListOrdered } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  RELEASE_TEXT_COLORS,
  releaseColorId,
  releaseDetailForEditor,
  sanitizeReleaseHtml,
  type ReleaseTextColorId,
} from '../../lib/releaseRichText'

interface RichTextEditorProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function selectionInside(editor: HTMLElement): Selection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const node = selection.anchorNode
  if (!node || !editor.contains(node)) return null
  return selection
}

function runCommand(editor: HTMLElement, command: string, arg?: string) {
  editor.focus()
  if (!selectionInside(editor)) return
  document.execCommand('styleWithCSS', false, 'false')
  document.execCommand(command, false, arg)
}

function clearColor(editor: HTMLElement) {
  const selection = selectionInside(editor)
  if (!selection || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  const root = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as HTMLElement
    : range.commonAncestorContainer.parentElement
  if (!root || !editor.contains(root)) return
  const colored = root.querySelectorAll('font, span[data-color], span[style*="color"]')
  colored.forEach(node => {
    try {
      if (!range.intersectsNode(node)) return
    } catch {
      return
    }
    const parent = node.parentNode
    if (!parent) return
    while (node.firstChild) parent.insertBefore(node.firstChild, node)
    parent.removeChild(node)
  })
}

function activeColorId(): ReleaseTextColorId | null {
  const value = document.queryCommandValue('foreColor')
  return releaseColorId(value)
}

export function RichTextEditor({ label, value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const [bold, setBold] = useState(false)
  const [bullets, setBullets] = useState(false)
  const [numbered, setNumbered] = useState(false)
  const [color, setColor] = useState<ReleaseTextColorId | null>(null)
  const [empty, setEmpty] = useState(() => !value.trim())

  const publish = () => {
    const editor = editorRef.current
    if (!editor) return
    const html = sanitizeReleaseHtml(editor.innerHTML)
    setEmpty(!editor.textContent?.trim())
    onChange(html)
  }

  const syncToolbar = () => {
    const editor = editorRef.current
    if (!editor || !selectionInside(editor)) return
    setBold(document.queryCommandState('bold'))
    setBullets(document.queryCommandState('insertUnorderedList'))
    setNumbered(document.queryCommandState('insertOrderedList'))
    setColor(activeColorId())
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    document.execCommand('defaultParagraphSeparator', false, 'p')
    if (document.activeElement === editor) return
    const next = releaseDetailForEditor(value)
    if (editor.innerHTML !== next) editor.innerHTML = next
    setEmpty(!editor.textContent?.trim())
  }, [value])

  useEffect(() => {
    const onSelection = () => syncToolbar()
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [])

  const apply = (command: string) => {
    const editor = editorRef.current
    if (!editor) return
    runCommand(editor, command)
    publish()
    syncToolbar()
  }

  const applyColor = (next: ReleaseTextColorId | null) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    if (!selectionInside(editor)) return
    if (!next) clearColor(editor)
    else runCommand(editor, 'foreColor', RELEASE_TEXT_COLORS.find(item => item.id === next)?.hex)
    publish()
    setColor(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-gray-600 dark:text-gray-300">
        {label}
      </span>
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-600 dark:bg-card">
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
          <ToolbarButton label="Bold" pressed={bold} onClick={() => apply('bold')}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Bulleted list" pressed={bullets} onClick={() => apply('insertUnorderedList')}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" pressed={numbered} onClick={() => apply('insertOrderedList')}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />
          <ToolbarButton label="Default colour" pressed={color == null} onClick={() => applyColor(null)}>
            <span className="text-xs font-semibold text-heading">A</span>
          </ToolbarButton>
          {RELEASE_TEXT_COLORS.map(item => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              aria-pressed={color === item.id}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyColor(item.id)}
              className={cn(
                'h-5 w-5 rounded-full border border-black/10 cursor-pointer attex-focus',
                color === item.id && 'ring-2 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-card',
              )}
              style={{ backgroundColor: item.hex }}
            />
          ))}
        </div>
        <div className="relative">
          {empty ? (
            <p className="pointer-events-none absolute left-3 top-2.5 text-sm text-placeholder">
              {placeholder}
            </p>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-labelledby={labelId}
            spellCheck
            onInput={publish}
            onBlur={publish}
            onKeyUp={syncToolbar}
            onMouseUp={syncToolbar}
            className="release-rich min-h-[16rem] w-full px-3 py-2.5 text-sm leading-relaxed text-heading outline-none"
          />
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-heading cursor-pointer attex-focus',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        pressed && 'bg-gray-100 text-accent dark:bg-gray-800',
      )}
    >
      {children}
    </button>
  )
}
