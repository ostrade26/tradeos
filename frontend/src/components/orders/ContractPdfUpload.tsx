import { useRef, useState, type DragEvent } from 'react'
import { FileUp, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
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

export function ContractPdfUpload({ side, onParsed, onBeforeApply, embedded = false }: ContractPdfUploadProps) {
  const store = useTradeStore()
  const isPO = side === 'purchase'
  const inputRef = useRef<HTMLInputElement>(null)
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
      setError(err instanceof Error ? err.message : 'Could not save company from PDF')
    }
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF contract confirmation')
      return
    }

    setLoading(true)
    setError('')
    setFileName(file.name)
    setResolutionOpen(false)
    setPendingParsed(null)
    setCollapsed(false)

    try {
      const parsed = await parseContractPdf(file)
      await resolveParties(parsed)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : 'Failed to read PDF')
    } finally {
      setLoading(false)
    }
  }

  const openFilePicker = () => {
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
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const imported = !!preview && !error && !resolutionOpen
  const toggleCollapsed = () => setCollapsed(c => !c)

  const shellClass = cn(
    'overflow-hidden',
    !embedded && 'rounded-md bg-card shadow-[var(--shadow-card)]',
    !imported && !embedded && 'border border-dashed border-gray-200 dark:border-gray-700',
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      <div className={shellClass}>
        {imported ? (
          <>
            <div className={cn('flex items-start gap-3', embedded ? 'pb-1' : 'p-6')}>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex min-w-0 flex-1 items-start gap-2.5 text-left rounded-md -m-1 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer attex-focus"
                aria-expanded={!collapsed}
              >
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">Contract imported</h3>
                  <p className="text-xs text-muted mt-0.5 truncate">{fileName}</p>
                </div>
              </button>

              <Button
                variant="outline"
                size="sm"
                loading={loading}
                className="shrink-0 self-center"
                onClick={() => inputRef.current?.click()}
              >
                {loading ? 'Reading PDF…' : 'Replace PDF'}
              </Button>

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
                embedded ? 'mt-4 pt-4' : 'px-6 py-4',
              )}>
                <PdfImportReview parsed={preview} isPO={isPO} itemCorrection={itemCorrection} />
              </div>
            )}
          </>
        ) : (
          <div className={embedded ? undefined : 'p-6'}>
            {!embedded && (
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <FileUp className="h-4 w-4 text-accent" />
                Import from Contract PDF
              </h3>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={openFilePicker}
              onDragOver={onDragOver}
              onDragEnter={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center cursor-pointer attex-focus',
                'transition-colors',
                loading && 'pointer-events-none opacity-70',
                dragOver
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-gray-300 bg-gray-50/60 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/30 dark:hover:border-gray-500',
              )}
            >
              <FileUp className={cn('h-6 w-6', dragOver ? 'text-accent' : 'text-muted')} />
              <p className="text-sm font-medium text-heading">
                {loading ? 'Reading PDF…' : dragOver ? 'Drop PDF to import' : 'Drop PDF here, or browse'}
              </p>
              <p className="text-xs text-muted max-w-sm text-pretty leading-relaxed">
                Broker contract confirmation to pre-fill this {isPO ? 'purchase order (PO)' : 'sales order (SO)'}.
                {isPO ? ' Seller' : ' Buyer'} and contract fields are mapped automatically.
                {isPO ? ' Buyer is always your account.' : ' Seller is always your account.'}
                {' '}Open <Link to="/contracts" className="text-accent hover:underline">Contracts</Link> to file the original.
              </p>
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-xs mt-1',
                  'border border-accent/40 bg-white text-accent dark:border-accent/50 dark:bg-card',
                )}
              >
                {loading ? 'Reading PDF…' : 'Browse'}
              </span>
            </button>
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
}
