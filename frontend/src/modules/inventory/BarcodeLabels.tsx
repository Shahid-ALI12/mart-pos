import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Barcode, Printer, Download, Plus, Trash2, Eye } from 'lucide-react'
import JsBarcode from 'jsbarcode'

interface LabelItem {
  id: string
  sku: string
  name: string
  price: number
  batchNumber: string
  expiryDate: string
  qty: number
  includePrice: boolean
  includeBatch: boolean
  includeExpiry: boolean
}

const mockProducts = [
  { sku: 'SKU001', name: 'Premium Basmati Rice 1kg', price: 85, unit: 'pcs' },
  { sku: 'SKU002', name: 'Full Cream Milk 1L', price: 58, unit: 'pcs' },
  { sku: 'SKU003', name: 'Wheat Flour 5kg', price: 220, unit: 'pcs' },
  { sku: 'SKU004', name: 'Refined Sunflower Oil 1L', price: 135, unit: 'pcs' },
  { sku: 'SKU005', name: 'Toor Dal 1kg', price: 145, unit: 'pcs' },
]

const labelSizes = [
  { value: '50x25', label: '50mm x 25mm (Standard)', width: 200, height: 100 },
  { value: '60x30', label: '60mm x 30mm (Large)', width: 240, height: 120 },
  { value: '40x20', label: '40mm x 20mm (Small)', width: 160, height: 80 },
  { value: '100x50', label: '100mm x 50mm (Extra Large)', width: 400, height: 200 },
]

export function BarcodeLabels() {
  const [items, setItems] = useState<LabelItem[]>([
    { id: '1', sku: '', name: '', price: 0, batchNumber: '', expiryDate: '', qty: 1, includePrice: true, includeBatch: false, includeExpiry: false }
  ])
  const [labelSize, setLabelSize] = useState('50x25')
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'EAN13' | 'CODE39'>('CODE128')
  const [previewMode, setPreviewMode] = useState(false)

  const selectedSize = labelSizes.find(s => s.value === labelSize) || labelSizes[0]

  const handleProductSelect = (id: string, sku: string) => {
    const product = mockProducts.find(p => p.sku === sku)
    if (product) {
      setItems(items.map(i => i.id === id ? { 
        ...i, 
        sku: product.sku, 
        name: product.name, 
        price: product.price,
        unit: product.unit
      } : i))
    }
  }

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), sku: '', name: '', price: 0, batchNumber: '', expiryDate: '', qty: 1, includePrice: true, includeBatch: false, includeExpiry: false }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof LabelItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const generateBarcode = (sku: string, type: string): string => {
    const canvas = document.createElement('canvas')
    try {
      JsBarcode(canvas, sku, { format: type as any, width: 2, height: 50, displayValue: true, fontSize: 16 })
      return canvas.toDataURL('image/png')
    } catch {
      return ''
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let html = `
      <html><head><title>Barcode Labels</title>
      <style>
        body { margin: 0; padding: 20px; font-family: Arial; }
        .label { 
          width: ${selectedSize.width}px; 
          height: ${selectedSize.height}px; 
          border: 1px solid #ccc; 
          display: inline-flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          padding: 5px; 
          box-sizing: border-box; 
          page-break-inside: avoid;
          margin: 2px;
        }
        .label-row { display: flex; flex-wrap: wrap; }
        .sku { font-family: monospace; font-size: 10px; margin-top: 4px; }
        .name { font-size: 11px; font-weight: bold; text-align: center; margin: 2px 0; }
        .price { font-size: 14px; font-weight: bold; color: #333; }
        .details { font-size: 8px; color: #666; text-align: center; }
        .barcode-img { max-width: 90%; height: auto; }
        @media print { .no-print { display: none; } }
      </style>
      </head><body>
      <div class="no-print" style="margin-bottom: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">Print Labels</button>
        <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; margin-left: 10px;">Close</button>
      </div>
      <div class="label-row">
    `

    items.forEach(item => {
      if (!item.sku) return
      const barcodeDataUrl = generateBarcode(item.sku, barcodeType)
      for (let i = 0; i < item.qty; i++) {
        html += `
          <div class="label">
            <img class="barcode-img" src="${barcodeDataUrl}" alt="${item.sku}" />
            <div class="sku">${item.sku}</div>
            <div class="name">${item.name}</div>
            ${item.includePrice ? `<div class="price">₹${item.price.toFixed(2)}</div>` : ''}
            <div class="details">
              ${item.includeBatch && item.batchNumber ? `Batch: ${item.batchNumber}<br/>` : ''}
              ${item.includeExpiry && item.expiryDate ? `Expiry: ${item.expiryDate}<br/>` : ''}
            </div>
          </div>
        `
      }
    })

    html += '</div></body></html>'
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Barcode Labels</h1>
          <p className="text-gray-500 mt-1">Generate and print barcode labels for products</p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Print Labels
        </Button>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Label Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Label Size</Label>
            <Select value={labelSize} onValueChange={setLabelSize}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {labelSizes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Barcode Type</Label>
            <Select value={barcodeType} onValueChange={setBarcodeType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">CODE128 (Recommended)</SelectItem>
                <SelectItem value="EAN13">EAN-13 (Retail)</SelectItem>
                <SelectItem value="CODE39">CODE39</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Label className="w-full">Options</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={items[0]?.includePrice} onChange={(e) => items.forEach(i => updateItem(i.id, 'includePrice', e.target.checked))} className="rounded border-gray-300" />
              <span className="text-sm">Include Price</span>
            </label>
          </div>
          <div className="flex items-end">
            <Label className="w-full">&nbsp;</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={items[0]?.includeBatch} onChange={(e) => items.forEach(i => updateItem(i.id, 'includeBatch', e.target.checked))} className="rounded border-gray-300" />
              <span className="text-sm">Include Batch</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Label Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Labels to Print ({items.length} products)</CardTitle>
          <Button variant="outline" onClick={addItem} className="gap-2" size="sm">
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Batch No.</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="w-12">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Select value={item.sku} onValueChange={(v) => handleProductSelect(item.id, v)}>
                        <SelectTrigger className="w-[300px]">
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {mockProducts.map(p => <SelectItem key={p.sku} value={p.sku}>{p.sku} - {p.name} (₹${p.price})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {item.name && <p className="text-sm text-gray-500 mt-1">{item.name}</p>}
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="1" max="100" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)} className="w-[70px]" />
                    </TableCell>
                    <TableCell>
                      <Input placeholder="Batch No." value={item.batchNumber} onChange={(e) => updateItem(item.id, 'batchNumber', e.target.value)} className="w-[130px]" />
                    </TableCell>
                    <TableCell>
                      <Input type="date" value={item.expiryDate} onChange={(e) => updateItem(item.id, 'expiryDate', e.target.value)} className="w-[140px]" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Label Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg min-h-[200px]">
            {items.filter(i => i.sku).map(item => (
              <div key={item.id} style={{ 
                width: selectedSize.width, 
                height: selectedSize.height, 
                border: '1px solid #ccc', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '5px', 
                boxSizing: 'border-box',
                background: 'white',
                margin: '2px'
              }}>
                <img 
                  src={generateBarcode(item.sku, barcodeType)} 
                  alt={item.sku} 
                  style={{ maxWidth: '90%', height: 'auto' }} 
                />
                <div style={{ fontFamily: 'monospace', fontSize: '10px', marginTop: '4px' }}>{item.sku}</div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'center', margin: '2px 0' }}>{item.name}</div>
                {item.includePrice && <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>₹{item.price.toFixed(2)}</div>}
                <div style={{ fontSize: '8px', color: '#666', textAlign: 'center' }}>
                  {item.includeBatch && item.batchNumber && `Batch: ${item.batchNumber}`}
                  {item.includeBatch && item.includeExpiry && item.batchNumber && item.expiryDate && '<br/>' }
                  {item.includeExpiry && item.expiryDate && `Expiry: ${item.expiryDate}`}
                </div>
              </div>
            ))}
            {items.every(i => !i.sku) && (
              <div className="w-full text-center text-gray-400 py-20">
                <Barcode className="w-12 h-12 mx-auto mb-4" />
                <p>Add products to see label preview</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}