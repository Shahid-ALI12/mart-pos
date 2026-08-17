// modules/settings/index.tsx — General settings + other config stubs
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Monitor, Database, Wifi, Cpu, Settings } from 'lucide-react'

export function GeneralSettings() {
  const qc = useQueryClient()
  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [shopEmail, setShopEmail] = useState('')
  const [gstin, setGstin] = useState('')
  const [invoicePrefix, setInvoicePrefix] = useState('')
  const [invoiceSeries, setInvoiceSeries] = useState('')

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await invoke<Record<string, string>>('get_settings')
      return res
    },
  })

  useEffect(() => {
    if (data) {
      // values are stored as JSON strings — unwrap
      const unwrap = (v: string) => v ? v.replace(/^"|"$/g, '') : ''
      setShopName(unwrap(data.shop_name || ''))
      setShopAddress(unwrap(data.shop_address || ''))
      setShopPhone(unwrap(data.shop_phone || ''))
      setShopEmail(unwrap(data.shop_email || ''))
      setGstin(unwrap(data.gstin || ''))
      setInvoicePrefix(unwrap(data.invoice_prefix || ''))
      setInvoiceSeries(unwrap(data.invoice_series || '') as any)
    }
  }, [data])

  const saveMut = useMutation({
    mutationFn: async () => {
      const updates = { shop_name: JSON.stringify(shopName), shop_address: JSON.stringify(shopAddress), shop_phone: JSON.stringify(shopPhone), shop_email: JSON.stringify(shopEmail), gstin: JSON.stringify(gstin), invoice_prefix: JSON.stringify(invoicePrefix), invoice_series: invoiceSeries }
      for (const [key, value] of Object.entries(updates)) {
        await invoke('update_setting', { key, value })
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved') },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="w-6 h-6" /> General Settings</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Store Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Shop Name</Label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} /></div>
          <div><Label>Address</Label><Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Phone</Label><Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} /></div>
          </div>
          <div><Label>GSTIN</Label><Input value={gstin} onChange={(e) => setGstin(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Invoice Prefix</Label><Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="INV" /></div>
            <div><Label>Invoice Series (next #)</Label><Input type="number" value={invoiceSeries} onChange={(e) => setInvoiceSeries(e.target.value)} /></div>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving...' : 'Save Settings'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ponytail: these config pages are stubs — implement when the corresponding features land
export function CounterSetup() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Monitor className="w-6 h-6" /> Counter Setup</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Counter management — locations are defined by DB schema seed. UI management coming when needed.</p></CardContent></Card></div>
}
export function TaxSetup() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6">Tax Setup (GST)</h1><Card><CardContent><p className="text-gray-500 text-center py-8">GST rates are set per-product and per-category. Dedicated tax configuration page coming when needed.</p></CardContent></Card></div>
}
export function BackupRestore() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Database className="w-6 h-6" /> Backup & Restore</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Database is encrypted with SQLCipher. Backup/restore commands coming when needed — for now, copy main.db and db.key from app data dir.</p></CardContent></Card></div>
}
export function SyncSettings() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Wifi className="w-6 h-6" /> Sync Settings</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Multi-counter LAN sync (WebRTC) — not yet implemented. Coming when multi-counter support is needed.</p></CardContent></Card></div>
}
export function HardwareConfig() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Cpu className="w-6 h-6" /> Hardware Configuration</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Hardware integration (printer, scanner, cash drawer, scale) — coming when hardware is connected.</p></CardContent></Card></div>
}
