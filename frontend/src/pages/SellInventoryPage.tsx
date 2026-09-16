import { useParams } from 'react-router-dom'
import { Package } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { useTradeStore } from '../store/TradeStore'
import { OrderEntryPage } from './OrderEntryPage'

export function SellInventoryPage() {
  const { lots } = useTradeStore()
  const { lotId } = useParams()
  const lot = lots.find(l => l.id === lotId)

  if (!lot) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Lot not found"
          breadcrumb={<Breadcrumb items={[
            { label: 'Tradeal', href: '/' },
            { label: 'Inventory', href: '/inventory' },
            { label: 'Sell' },
          ]} />}
        />
        <EmptyState
          card
          icon={<Package className="h-10 w-10" />}
          title="No lot found"
          description="This inventory lot does not exist."
          action={<Button to="/inventory" variant="outline">Back to Inventory</Button>}
        />
      </div>
    )
  }

  if (lot.available <= 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Nothing to sell"
          subtitle={`${lot.lotNumber} · ${lot.commodity}`}
          breadcrumb={<Breadcrumb items={[
            { label: 'Tradeal', href: '/' },
            { label: 'Inventory', href: '/inventory' },
            { label: lot.lotNumber, href: `/inventory/${lot.id}` },
            { label: 'Sell' },
          ]} />}
        />
        <EmptyState
          card
          icon={<Package className="h-10 w-10" />}
          title="No available stock"
          description="All quantity on this lot is already allocated to sales orders."
          action={<Button to={`/inventory/${lot.id}`} variant="outline">Back to lot</Button>}
        />
      </div>
    )
  }

  const poRef = lot.lotNumber.replace(/^LOT-/, '')

  return (
    <OrderEntryPage
      side="sale"
      linkedPoRef={poRef}
      sellFromLot={{
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        commodity: lot.commodity,
        available: lot.available,
      }}
    />
  )
}
