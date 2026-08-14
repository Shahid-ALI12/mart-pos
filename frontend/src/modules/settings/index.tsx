import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Settings, Monitor, FileText, Database, Wifi, Cpu } from 'lucide-react'

export function GeneralSettings() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">General Settings</h1>
          <p className="text-gray-500">Store information and preferences</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Store Configuration</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">General Settings module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CounterSetup() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Counter Setup</h1>
          <p className="text-gray-500">Configure POS counters and terminals</p>
        </div>
        <Button className="gap-2"><Monitor className="w-4 h-4" /> Add Counter</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Counter Management</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Counter Setup module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function TaxSetup() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tax Setup (GST)</h1>
          <p className="text-gray-500">Configure GST rates, HSN codes, tax groups</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>GST Configuration</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Tax Setup module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function BackupRestore() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Backup & Restore</h1>
          <p className="text-gray-500">Database backup and disaster recovery</p>
        </div>
        <div className="flex gap-2">
          <Button className="gap-2"><Database className="w-4 h-4" /> Backup Now</Button>
          <Button variant="outline" className="gap-2"><FileText className="w-4 h-4" /> Restore</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Backup Management</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Backup & Restore module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function SyncSettings() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sync Settings</h1>
          <p className="text-gray-500">Multi-counter LAN synchronization</p>
        </div>
        <Button className="gap-2"><Wifi className="w-4 h-4" /> Configure Sync</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Synchronization</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Sync Settings module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function HardwareConfig() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Hardware Configuration</h1>
          <p className="text-gray-500">Barcode scanner, thermal printer, cash drawer, weighing scale</p>
        </div>
        <Button className="gap-2"><Cpu className="w-4 h-4" /> Add Device</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Hardware Devices</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Hardware Configuration module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}