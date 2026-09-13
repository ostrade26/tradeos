import {
  CheckCircle2,
  CreditCard,
  FileText,
  Package,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { Activity } from '../data/mockData'

export const activityTypeConfig: Record<
  Activity['type'],
  { icon: LucideIcon; color: string; label: string }
> = {
  contract_created: { icon: FileText, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950', label: 'Contract' },
  payment_received: { icon: CreditCard, color: 'bg-emerald-50 text-success dark:bg-emerald-950/30', label: 'Payment' },
  goods_dispatched: { icon: Truck, color: 'bg-amber-50 text-warning dark:bg-amber-950/30', label: 'Dispatch' },
  stock_allocated: { icon: Package, color: 'bg-purple-50 text-purple-600 dark:bg-purple-950', label: 'Allocation' },
  inventory_sold: { icon: ShoppingCart, color: 'bg-sky-50 text-sky-600 dark:bg-sky-950', label: 'Sale' },
  delivery_completed: { icon: CheckCircle2, color: 'bg-emerald-50 text-success dark:bg-emerald-950/30', label: 'Delivery' },
  lift_recorded: { icon: Truck, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950', label: 'Lift' },
  po_created: { icon: FileText, color: 'bg-orange-50 text-orange-600 dark:bg-orange-950', label: 'PO' },
  so_created: { icon: ShoppingCart, color: 'bg-teal-50 text-teal-600 dark:bg-teal-950', label: 'SO' },
  order_deleted: { icon: Trash2, color: 'bg-red-50 text-danger dark:bg-red-950/30', label: 'Deleted' },
  order_updated: { icon: FileText, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950', label: 'Updated' },
  order_deletion_scheduled: { icon: Trash2, color: 'bg-amber-50 text-warning dark:bg-amber-950/30', label: 'Deletion scheduled' },
  po_buy_back: { icon: RotateCcw, color: 'bg-amber-50 text-amber-700 dark:bg-amber-950', label: 'Buy back' },
  balance_cash_settled: { icon: CreditCard, color: 'bg-emerald-50 text-success dark:bg-emerald-950/30', label: 'Cash settled' },
  order_closed_carried: { icon: Package, color: 'bg-purple-50 text-purple-600 dark:bg-purple-950', label: 'Carried forward' },
  order_short_closed: { icon: CheckCircle2, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800', label: 'Short closed' },
}
