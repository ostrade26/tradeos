import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../ui/Tabs'
import { platformAccessIcon, platformFeaturesAccessNavIcon } from '../../lib/platformProductIcons'
import { platformApi } from '../../api/platformApi'
import {
  PlatformFeatureCatalogPanel,
  type PlatformFeatureCatalogPanelHandle,
} from './PlatformFeatureCatalogPanel'
import {
  PlatformFeatureAccessPanel,
  type PlatformFeatureAccessPanelHandle,
} from './PlatformFeatureAccessPanel'

export type PlatformAddOnsTab = 'catalog' | 'access'

export type PlatformAddOnsAdminPanelHandle = {
  refresh: () => Promise<void>
}

export const PlatformAddOnsAdminPanel = forwardRef<
  PlatformAddOnsAdminPanelHandle,
  { onOpenAccessCountChange?: (open: number) => void }
>(function PlatformAddOnsAdminPanel({ onOpenAccessCountChange }, ref) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: PlatformAddOnsTab = tabParam === 'access' ? 'access' : 'catalog'
  const [openAccess, setOpenAccess] = useState(0)
  const catalogRef = useRef<PlatformFeatureCatalogPanelHandle>(null)
  const accessRef = useRef<PlatformFeatureAccessPanelHandle>(null)

  const syncOpenAccessCount = useCallback(async () => {
    try {
      const res = await platformApi.listFeatureInterests()
      const open = res.interests.filter(i => i.status === 'interested').length
      setOpenAccess(open)
      onOpenAccessCountChange?.(open)
    } catch {
      /* tab badge is best-effort */
    }
  }, [onOpenAccessCountChange])

  useEffect(() => {
    void syncOpenAccessCount()
  }, [syncOpenAccessCount])

  useEffect(() => {
    if (searchParams.get('interestId') && tabParam !== 'access') {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'access')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, tabParam])

  const setTab = (id: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', id)
    if (id !== 'access') next.delete('interestId')
    setSearchParams(next, { replace: true })
  }

  const handleOpenCount = (open: number) => {
    setOpenAccess(open)
    onOpenAccessCountChange?.(open)
  }

  const refresh = useCallback(async () => {
    if (tab === 'catalog') {
      await catalogRef.current?.refresh()
    } else {
      await accessRef.current?.refresh()
    }
    await syncOpenAccessCount()
  }, [tab, syncOpenAccessCount])

  useImperativeHandle(ref, () => ({ refresh }), [refresh])

  return (
    <div className="space-y-4">
      <Tabs
        active={tab}
        onChange={setTab}
        className="gap-6"
        buttonClassName="pt-2.5 px-0"
        tabs={[
          { id: 'catalog', label: 'Features', icon: platformFeaturesAccessNavIcon },
          {
            id: 'access',
            label: openAccess > 0 ? `Access (${openAccess})` : 'Access',
            icon: platformAccessIcon,
          },
        ]}
      />
      {tab === 'catalog' ? (
        <PlatformFeatureCatalogPanel ref={catalogRef} />
      ) : (
        <PlatformFeatureAccessPanel ref={accessRef} onOpenCountChange={handleOpenCount} />
      )}
    </div>
  )
})
