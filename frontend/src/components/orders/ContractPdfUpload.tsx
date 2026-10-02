import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { FileUp, AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { parseContractPdf, isLikelyPersonName, type ParsedContractPdf } from '../../lib/parseContractPdf'
import { resolveCompany, type CompanyResolutionResult } from '../../lib/companyResolution'
import { buildPdfImportFormValues, findAccountCompany } from '../../lib/pdfImport'
import { canonicalItemName, collectItemNames } from '../../lib/itemResolution'
import { useTradeStore } from '../../store/TradeStore'
import type { Company, OrderSide } from '../../data/mockData'
import { PdfImportReview } from './PdfImportReview'
import {
  CompanyResolutionModal,
  buildResolutionDrafts,
  type PartyResolutionDraft,
} from './CompanyResolutionModal'
import { cn } from '../../lib/utils'

interface ContractPdfUploadProps {
  side: OrderSide
  onParsed: (values: Record<string, string>, parsed: ParsedContractPdf) => void
  onBeforeApply?: () => boolean
  /** Render without outer Card — for tabbed entry layouts. */
  embedded?: boolean
  onQueueChange?: (state: { remaining: number; saved: number; currentName: string }) => void
  /** Current PDF in the queue, for an in-app preview. Null when the queue is empty. */
  onActiveFile?: (file: File | null) => void
  /** Called after the lineup is emptied. */
  onCleared?: () => void
}

export type ContractPdfUploadHandle = {
  /** Drop the PDF that was just saved. Returns how many are still lined up. */
  completeCurrent: () => number
  /** Read the PDF now at the front of the queue into the form. */
  loadNext: () => void
}

const SKIP_PARTY_RESOLUTION: CompanyResolutionResult = {
  extractedName: '',
  normalizedName: '',
  match: null,
  confidence: 'high',
  suggestions: [],
}

function companyNameForResolution(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || isLikelyPersonName(trimmed)) return ''
  return trimmed
}

function stubCompany(name: string, type: 'seller' | 'buyer'): Company {
  return {
    id: '',
    officialName: name,
    aliases: [],
    types: [type],
    location: '',
  }
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/** Queue, Add PDFs, and the PDF row strip. One file at a time while false. Turning this on also means restore preview + Add PDFs + rows. */
const ALLOW_MULTIPLE_CONTRACT_PDFS = false

export const ContractPdfUpload = forwardRef<ContractPdfUploadHandle, ContractPdfUploadProps>(function ContractPdfUpload({
  side,
  onParsed,
  onBeforeApply,
  embedded = false,
  onQueueChange,
  onActiveFile,
  onCleared,
}, ref) {
  const store = useTradeStore()
  const isPO = side === 'purchase'
  const inputRef = useRef<HTMLInputElement>(null)
  const addInputId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ParsedContractPdf | null>(null)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [resolutionDrafts, setResolutionDrafts] = useState<PartyResolutionDraft[]>([])
  const [pendingParsed, setPendingParsed] = useState<ParsedContractPdf | null>(null)
  const [resolvedSeller, setResolvedSeller] = useState<Company | null>(null)
  const [resolvedBuyer, setResolvedBuyer] = useState<Company | null>(null)
  const [itemCorrection, setItemCorrection] = useState<{ from: string; to: string } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [queuedNames, setQueuedNames] = useState<string[]>([])
  const [headError, setHeadError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(0)
  const onQueueChangeRef = useRef(onQueueChange)
  const onActiveFileRef = useRef(onActiveFile)
  const onClearedRef = useRef(onCleared)
  onQueueChangeRef.current = onQueueChange
  onActiveFileRef.current = onActiveFile
  onClearedRef.current = onCleared
  const queueRef = useRef<File[]>([])

  const publishQueue = (files: File[], saved: number, active?: number) => {
    const index = files.length === 0
      ? 0
      : Math.min(Math.max(active ?? activeIndexRef.current, 0), files.length - 1)
    activeIndexRef.current = index
    setActiveIndex(index)
    queueRef.current = files
    savedRef.current = saved
    setSavedCount(saved)
    setQueuedNames(files.map(file => file.name))
    onQueueChangeRef.current?.({
      remaining: files.length,
      saved,
      currentName: files[index]?.name ?? '',
    })
    onActiveFileRef.current?.(files[index] ?? null)
  }

  const accountParty = () => findAccountCompany(store.companies)

  const itemCatalog = () => collectItemNames({
    items: store.items,
    tradeOrders: store.tradeOrders,
    lots: store.lots,
  })

  const finishImport = (parsed: ParsedContractPdf, seller: Company, buyer: Company) => {
    const catalog = {
      items: store.items,
      tradeOrders: store.tradeOrders,
      lots: store.lots,
    }
    const resolvedItem = canonicalItemName(parsed.itemName, itemCatalog())
    const extractedItem = parsed.itemName.trim()
    setItemCorrection(
      extractedItem && resolvedItem && resolvedItem !== extractedItem
        ? { from: extractedItem, to: resolvedItem }
        : null,
    )
    if (onBeforeApply && !onBeforeApply()) return
    setPreview(parsed)
    onParsed(buildPdfImportFormValues(parsed, side, { seller, buyer }, store.companies, catalog), parsed)
    setHeadError(false)
    setPendingParsed(null)
    setResolvedSeller(null)
    setResolvedBuyer(null)
    setResolutionDrafts([])
    setResolutionOpen(false)
    setCollapsed(true)
  }

  const resolveParties = async (parsed: ParsedContractPdf) => {
    const account = accountParty()

    if (isPO) {
      const sellerResult = resolveCompany(companyNameForResolution(parsed.sellerName), store.companies, 'seller')
      let seller: Company | null = null

      if (sellerResult.confidence === 'high' && sellerResult.match) {
        seller = await store.linkHighConfidenceCompany(sellerResult, 'seller')
      }

      const drafts = buildResolutionDrafts(sellerResult, SKIP_PARTY_RESOLUTION)
      if (drafts.length > 0) {
        setPendingParsed(parsed)
        setResolvedSeller(seller)
        setResolutionDrafts(drafts)
        setResolutionOpen(true)
        setPreview(parsed)
        return
      }

      if (!seller) {
        setHeadError(true)
        setError('Could not resolve seller from PDF')
        return
      }

      finishImport(parsed, seller, account)
      return
    }

    const buyerResult = resolveCompany(companyNameForResolution(parsed.buyerName), store.companies, 'buyer')
    let resolvedBuyer: Company | null = null

    if (buyerResult.confidence === 'high' && buyerResult.match) {
      resolvedBuyer = await store.linkHighConfidenceCompany(buyerResult, 'buyer')
    }

    const drafts = buildResolutionDrafts(SKIP_PARTY_RESOLUTION, buyerResult)
    if (drafts.length > 0) {
      setPendingParsed(parsed)
      setResolvedBuyer(resolvedBuyer)
      setResolutionDrafts(drafts)
      setResolutionOpen(true)
      setPreview(parsed)
      return
    }

    finishImport(
      parsed,
      account,
      resolvedBuyer ?? stubCompany(parsed.buyerName, 'buyer'),
    )
  }

  const handleResolutionConfirm = async (drafts: PartyResolutionDraft[]) => {
    if (!pendingParsed) return

    try {
    let seller = isPO ? resolvedSeller : accountParty()
    let buyer: Company | null = isPO ? accountParty() : resolvedBuyer

    for (const draft of drafts) {
      const company = await store.confirmCompanyLink({
        extractedName: draft.result.extractedName,
        companyId: draft.selectedId === '__new__' ? undefined : draft.selectedId,
        officialName: draft.selectedId === '__new__' ? draft.newOfficialName : undefined,
        type: draft.role === 'seller' ? 'seller' : 'buyer',
        gst: draft.role === 'seller' ? pendingParsed.sellerGst : pendingParsed.buyerGst,
      })
      if (draft.role === 'seller') seller = company
      else buyer = company
    }

    finishImport(
      pendingParsed,
      seller ?? stubCompany(pendingParsed.sellerName, 'seller'),
      buyer ?? (isPO ? accountParty() : stubCompany(pendingParsed.buyerName, 'buyer')),
    )
    } catch (err) {
      setHeadError(true)
      setError(err instanceof Error ? err.message : 'Could not save company from PDF')
    }
  }

  const handleFile = async (file: File) => {
    setLoading(true)
    setError('')
    setHeadError(false)
    setFileName(file.name)
    setResolutionOpen(false)
    setPendingParsed(null)
    setCollapsed(false)

    try {
      const parsed = await parseContractPdf(file)
      await resolveParties(parsed)
    } catch (err) {
      setPreview(null)
      setHeadError(true)
      setError(err instanceof Error ? err.message : 'Failed to read PDF')
    } finally {
      setLoading(false)
    }
  }

  const addFiles = (incoming: File[]) => {
    const pdfs = incoming.filter(isPdfFile)
    if (pdfs.length === 0) {
      setError('Choose a PDF')
      return
    }
    if (!ALLOW_MULTIPLE_CONTRACT_PDFS) {
      const file = pdfs[0]
      publishQueue([file], savedRef.current)
      void handleFile(file)
      return
    }
    const starting = queueRef.current.length === 0
    const next = starting ? pdfs : [...queueRef.current, ...pdfs]
    publishQueue(next, savedRef.current)
    if (starting) void handleFile(pdfs[0])
  }

  useImperativeHandle(ref, () => ({
    completeCurrent() {
      const index = activeIndexRef.current
      const next = queueRef.current.filter((_, i) => i !== index)
      const saved = savedRef.current + (queueRef.current.length > 0 ? 1 : 0)
      const nextIndex = next.length === 0 ? 0 : Math.min(index, next.length - 1)
      setHeadError(false)
      publishQueue(next, saved, nextIndex)
      return next.length
    },
    loadNext() {
      const file = queueRef.current[activeIndexRef.current]
      if (file) void handleFile(file)
    },
  }))

  const removeQueued = (index: number) => {
    const current = activeIndexRef.current
    const next = queueRef.current.filter((_, i) => i !== index)
    const removedCurrent = index === current
    let nextActive = current
    if (index < current) nextActive = current - 1
    else if (removedCurrent) nextActive = Math.min(current, Math.max(next.length - 1, 0))
    if (removedCurrent) setHeadError(false)
    publishQueue(next, savedRef.current, nextActive)
    if (!removedCurrent) return
    const file = next[nextActive]
    if (file) {
      void handleFile(file)
      return
    }
    setPreview(null)
    setFileName('')
    setError('')
  }

  const clearAllQueued = () => {
    setHeadError(false)
    setPreview(null)
    setFileName('')
    setError('')
    setResolutionOpen(false)
    setPendingParsed(null)
    publishQueue([], savedRef.current)
    onClearedRef.current?.()
  }

  const openReplacePicker = () => {
    if (loading) return
    inputRef.current?.click()
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!loading) setDragOver(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (loading) return
    const file = e.dataTransfer.files
    if (file?.length) addFiles([...file])
  }

  useEffect(() => {
    const strip = stripRef.current
    const chip = strip?.querySelector<HTMLElement>(`[data-pdf-index="${activeIndex}"]`)
    if (!strip || !chip) return
    const left = chip.offsetLeft - strip.offsetLeft
    strip.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' })
  }, [activeIndex, queuedNames])

  const imported = !!preview && !error && !resolutionOpen
  const toggleCollapsed = () => setCollapsed(c => !c)

  const fileTags = queuedNames.length > 0 ? (
    <div className="flex items-stretch border-t border-gray-200 bg-gray-100/90 dark:border-gray-700 dark:bg-gray-800/50">
      <button
        type="button"
        className="shrink-0 border-r border-gray-200 bg-white px-2 text-heading hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-card dark:hover:bg-gray-800"
        aria-label="Scroll PDF list left"
        onClick={() => stripRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={stripRef} className="flex min-w-0 flex-1 overflow-x-auto">
      {queuedNames.map((name, index) => {
        const tone = index === activeIndex ? (headError ? 'error' : 'adding') : 'waiting'
        return (
          <span
            key={`${name}-${index}`}
            data-pdf-index={index}
            title={name}
            className={cn(
              'inline-flex max-w-[16rem] shrink-0 items-center gap-2 border-r border-gray-200 bg-gray-100/90 px-3 py-2.5 text-xs text-heading dark:border-gray-700 dark:bg-gray-800/50',
              tone === 'adding' && 'text-success',
              tone === 'error' && 'text-danger',
            )}
          >
            <span className="truncate">{name}</span>
            <button
              type="button"
              className="shrink-0 rounded text-current/70 hover:text-current cursor-pointer"
              aria-label={`Remove ${name}`}
              onClick={() => removeQueued(index)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )
      })}
      </div>
      <button
        type="button"
        className="shrink-0 border-l border-gray-200 bg-white px-2 text-heading hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-card dark:hover:bg-gray-800"
        aria-label="Scroll PDF list right"
        onClick={() => stripRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  ) : null

  const shellClass = cn(
    'overflow-hidden',
    !embedded && 'rounded-md bg-card shadow-[var(--shadow-card)]',
    !imported && !embedded && 'border border-dashed border-gray-200 dark:border-gray-700',
  )

  return (
    <>
      {createPortal(
        <input
          id={addInputId}
          type="file"
          accept=".pdf,application/pdf"
          multiple={ALLOW_MULTIPLE_CONTRACT_PDFS}
          className="sr-only"
          onChange={e => {
            const picked = e.target.files ? [...e.target.files] : []
            e.target.value = ''
            if (picked.length) addFiles(picked)
          }}
        />,
        document.body,
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={e => {
          const file = e.target.files ? [...e.target.files].find(isPdfFile) : undefined
          e.target.value = ''
          if (!file) {
            setError('Choose a PDF')
            return
          }
          const next = [file, ...queueRef.current.slice(1)]
          publishQueue(next, savedRef.current)
          void handleFile(file)
        }}
      />

      <div className={shellClass}>
        {imported ? (
          <>
            <div className={cn('flex items-start gap-3', embedded ? 'px-4 pb-4' : 'p-8')}>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex min-w-0 flex-1 items-start gap-2.5 text-left rounded-md -m-1 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer attex-focus"
                aria-expanded={!collapsed}
              >
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">
                    {savedCount + queuedNames.length}{' '}
                    {savedCount + queuedNames.length === 1 ? 'Contract' : 'Contracts'} imported
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Adding {preview?.brokerContractRef || fileName || '—'} now
                  </p>
                </div>
              </button>

              {ALLOW_MULTIPLE_CONTRACT_PDFS && (
              <label
                htmlFor={addInputId}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center justify-center self-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-heading cursor-pointer',
                  'hover:bg-gray-50 dark:border-gray-600 dark:bg-card',
                  loading && 'pointer-events-none opacity-70',
                )}
              >
                Add PDFs
              </label>
              )}
              {queuedNames.length <= 1 && (
                <button
                  type="button"
                  disabled={loading}
                  className="inline-flex h-9 shrink-0 items-center justify-center self-center rounded-md border border-accent bg-white px-3 text-xs font-medium text-accent cursor-pointer hover:bg-accent/5 disabled:opacity-70 dark:bg-card"
                  onClick={openReplacePicker}
                >
                  Replace PDF
                </button>
              )}
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center justify-center self-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-heading cursor-pointer hover:bg-gray-50 dark:border-gray-600 dark:bg-card"
                onClick={clearAllQueued}
              >
                Clear all
              </button>

              <button
                type="button"
                onClick={toggleCollapsed}
                className="shrink-0 self-center rounded-md p-1 text-muted hover:bg-gray-50 dark:hover:bg-gray-800/50 attex-focus"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Show extracted fields' : 'Hide extracted fields'}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} />
              </button>
            </div>

            {!collapsed && preview && (
              <div className={cn(
                'border-t border-gray-200 dark:border-gray-700',
                embedded ? 'mx-4 mt-4 pt-4' : 'px-8 py-4',
              )}>
                <PdfImportReview parsed={preview} isPO={isPO} itemCorrection={itemCorrection} />
              </div>
            )}
          </>
        ) : (
          <div className={embedded ? 'px-4 pb-4' : 'p-8'}>
            {!embedded && (
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <FileUp className="h-4 w-4 text-accent" />
                Import from Contract PDF
              </h3>
            )}
            <div
              onDragOver={onDragOver}
              onDragEnter={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                'rounded-md border border-dashed px-4 py-8 text-center',
                'transition-colors',
                loading && 'pointer-events-none opacity-70',
                dragOver
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-gray-300 bg-gray-50/60 dark:border-gray-600 dark:bg-gray-800/30',
              )}
            >
              <label
                htmlFor={loading ? undefined : addInputId}
                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2"
              >
                <FileUp className={cn('h-6 w-6', dragOver ? 'text-accent' : 'text-muted')} />
                <p className="text-sm font-medium text-heading">
                  {loading ? 'Reading PDF…' : dragOver ? 'Drop PDF to import' : 'Drop a PDF here, or browse'}
                </p>
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-xs mt-1',
                    'border border-accent/40 bg-white text-accent dark:border-accent/50 dark:bg-card',
                  )}
                >
                  {loading ? 'Reading PDF…' : 'Browse'}
                </span>
              </label>
              <p className="text-xs text-muted max-w-sm text-pretty leading-relaxed mx-auto mt-2">
                {ALLOW_MULTIPLE_CONTRACT_PDFS
                  ? `Each PDF becomes its own ${isPO ? 'purchase order' : 'sales order'}.`
                  : `This PDF becomes one ${isPO ? 'purchase order' : 'sales order'}.`}
                {' '}Seller, buyer, and contract fields are mapped from the PDF.
                {' '}Open <Link to="/contracts" className="text-accent hover:underline">Contracts</Link> to file the original.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className={cn(
            'flex items-start gap-2 rounded border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/30',
            embedded ? 'mt-4' : imported ? 'mx-6 mb-6' : 'mx-6 mb-6 -mt-3',
          )}>
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {preview && !error && resolutionOpen && (
          <div className={cn(
            'rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
            embedded ? 'mt-4' : imported ? 'mx-6 mb-6' : 'mx-6 mb-6 -mt-3',
          )}>
            Imported {fileName} — confirm company match below to finish.
          </div>
        )}
      </div>
      {ALLOW_MULTIPLE_CONTRACT_PDFS ? fileTags : null}

      <CompanyResolutionModal
        open={resolutionOpen}
        drafts={resolutionDrafts}
        onClose={() => {
          setResolutionOpen(false)
          setPendingParsed(null)
          setResolvedSeller(null)
          setResolvedBuyer(null)
        }}
        onConfirm={handleResolutionConfirm}
      />
    </>
  )
})
