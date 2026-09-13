import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { StatGrid, ContentGrid } from '../components/layout/PageGrid'
import { formatCurrency, formatQty } from '../lib/utils'
import { SEED_PRICE_TRENDS } from '../data/seedData'
import { useTradeStore } from '../store/TradeStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar
} from 'recharts'

export function AnalyticsPage() {
  const { revenueData, pipelineData, lots, retailers } = useTradeStore()
  const topCustomers = retailers
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 4)
    .map(r => ({ name: r.name.split(' ')[0], value: r.totalPurchases / 100000 }))

  const purchaseMtd = revenueData.reduce((s, r) => s + r.purchase, 0)
  const salesMtd = revenueData.reduce((s, r) => s + r.sales, 0)
  const volumeMtd = lots.reduce((s, l) => s + l.quantityPurchased, 0)
  const activeLots = lots.filter(l => l.remaining > 0).length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Analytics"
        subtitle="Trade performance and market trends"
        breadcrumb={<Breadcrumb items={[{ label: 'TradeOS', href: '/' }, { label: 'Analytics' }]} />}
      />

      <StatGrid cols={4}>
        <StatCard label="Trade Volume (MTD)" value={formatQty(volumeMtd)} change="Across all lots" changeType="neutral" />
        <StatCard label="Active Lots" value={String(activeLots)} change={`${lots.length} total lots`} changeType="neutral" />
        <StatCard label="Purchase Value" value={formatCurrency(purchaseMtd)} change="All months in register" changeType="neutral" />
        <StatCard label="Sales Value" value={formatCurrency(salesMtd)} change="All months in register" changeType="neutral" />
      </StatGrid>

      <ContentGrid cols={2} className="mb-4">
        <Card>
          <CardHeader title="Commodity Price Trends" subtitle="₹/10 KG · Last 6 weeks" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SEED_PRICE_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Line type="monotone" dataKey="palmOil" stroke="#2563eb" strokeWidth={2} dot={false} name="Palm Oil" />
                <Line type="monotone" dataKey="soybean" stroke="#059669" strokeWidth={2} dot={false} name="Soybean Oil" />
                <Line type="monotone" dataKey="coconut" stroke="#d97706" strokeWidth={2} dot={false} name="Coconut Oil" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 justify-center">
            {[{ label: 'Palm Oil', color: '#2563eb' }, { label: 'Soybean', color: '#059669' }, { label: 'Coconut', color: '#d97706' }].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
                <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenue Overview" subtitle="Purchase vs Sales · Last 6 months" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Area type="monotone" dataKey="purchase" stroke="#2563eb" fill="url(#pGrad)" strokeWidth={2} name="Purchase" />
                <Area type="monotone" dataKey="sales" stroke="#059669" fill="url(#sGrad)" strokeWidth={2} name="Sales" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </ContentGrid>

      <ContentGrid cols={2} className="mb-4">
        <Card>
          <CardHeader title="Trade Pipeline" subtitle="Active deals by stage" />
          <div className="h-64 flex items-center justify-center">
            {pipelineData.length === 0 ? (
              <p className="text-sm text-muted">No pipeline data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Customers" subtitle="By purchase volume" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}L`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v) * 100000)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </ContentGrid>
    </div>
  )
}
