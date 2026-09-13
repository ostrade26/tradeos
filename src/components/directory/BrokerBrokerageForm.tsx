import { Plus, Trash2 } from 'lucide-react'
import { BrokerageInput } from '../ui/BrokerageInput'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { BrokerageInputType } from '../../lib/orderForm'
import type { BrokerItemBrokerageFormRow } from '../../lib/brokerBrokerage'
import { randomUUID } from '../../lib/randomId'

export interface BrokerBrokerageFormState {
  purchaseBrokerageMode: BrokerageInputType
  purchaseBrokerageValue: string
  saleBrokerageMode: BrokerageInputType
  saleBrokerageValue: string
  itemBrokerages: BrokerItemBrokerageFormRow[]
}

export const emptyBrokerBrokerageForm: BrokerBrokerageFormState = {
  purchaseBrokerageMode: 'perTon',
  purchaseBrokerageValue: '',
  saleBrokerageMode: 'perTon',
  saleBrokerageValue: '',
  itemBrokerages: [],
}

interface BrokerBrokerageFormProps {
  value: BrokerBrokerageFormState
  onChange: (next: BrokerBrokerageFormState) => void
  itemOptions: string[]
}

function newItemRow(): BrokerItemBrokerageFormRow {
  return {
    key: randomUUID(),
    itemName: '',
    purchaseMode: 'perTon',
    purchaseValue: '',
    saleMode: 'perTon',
    saleValue: '',
  }
}

export function BrokerBrokerageForm({ value, onChange, itemOptions }: BrokerBrokerageFormProps) {
  const set = (patch: Partial<BrokerBrokerageFormState>) => onChange({ ...value, ...patch })

  const updateItemRow = (key: string, patch: Partial<BrokerItemBrokerageFormRow>) => {
    set({
      itemBrokerages: value.itemBrokerages.map(row =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    })
  }

  return (
    <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
      <div>
        <h4 className="text-sm font-semibold text-heading">Default brokerage</h4>
        <p className="text-xs text-muted mt-0.5">
          Applied automatically on future PO and SO entries for this broker.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BrokerageInput
          label="Purchase orders (PO)"
          mode={value.purchaseBrokerageMode}
          value={value.purchaseBrokerageValue}
          onModeChange={mode => set({ purchaseBrokerageMode: mode, purchaseBrokerageValue: '' })}
          onChange={purchaseBrokerageValue => set({ purchaseBrokerageValue })}
        />
        <BrokerageInput
          label="Sales orders (SO)"
          mode={value.saleBrokerageMode}
          value={value.saleBrokerageValue}
          onModeChange={mode => set({ saleBrokerageMode: mode, saleBrokerageValue: '' })}
          onChange={saleBrokerageValue => set({ saleBrokerageValue })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-heading">Item-specific rates</h4>
            <p className="text-xs text-muted mt-0.5">
              Override defaults for particular commodities — takes priority on matching items.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set({ itemBrokerages: [...value.itemBrokerages, newItemRow()] })}
          >
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>

        {value.itemBrokerages.length === 0 ? (
          <p className="text-xs text-muted rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-4 text-center">
            No item overrides yet. Defaults above apply to all items.
          </p>
        ) : (
          <div className="space-y-3">
            {value.itemBrokerages.map(row => (
              <div
                key={row.key}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Input
                    label="Item"
                    list={`broker-item-options-${row.key}`}
                    placeholder="e.g. Palm Oil"
                    value={row.itemName}
                    onChange={e => updateItemRow(row.key, { itemName: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => set({
                      itemBrokerages: value.itemBrokerages.filter(item => item.key !== row.key),
                    })}
                    className="mt-6 p-1.5 rounded-lg text-muted hover:text-danger hover:bg-gray-100 dark:hover:bg-gray-700/50"
                    aria-label="Remove item rate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <datalist id={`broker-item-options-${row.key}`}>
                    {itemOptions.map(item => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BrokerageInput
                    label="PO rate"
                    mode={row.purchaseMode}
                    value={row.purchaseValue}
                    onModeChange={mode => updateItemRow(row.key, { purchaseMode: mode, purchaseValue: '' })}
                    onChange={purchaseValue => updateItemRow(row.key, { purchaseValue })}
                  />
                  <BrokerageInput
                    label="SO rate"
                    mode={row.saleMode}
                    value={row.saleValue}
                    onModeChange={mode => updateItemRow(row.key, { saleMode: mode, saleValue: '' })}
                    onChange={saleValue => updateItemRow(row.key, { saleValue })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
