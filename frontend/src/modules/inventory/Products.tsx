import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { formatCurrency } from '../../shared/utils'
import { ProductWithDetails, Category, Brand, Unit } from '../../shared/types'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui/Card'
import {
  Plus, Search, Edit, Trash2, Eye, Barcode, Download, Upload, Filter,
  Package, Tag, Box, RotateCcw, AlertTriangle, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

export function Products() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'variants' | 'categories' | 'brands' | 'units'>('list')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchQuery, page],
    queryFn: async () => {
      try {
        return await invoke('list_products', { 
          query: searchQuery, 
          page, 
          pageSize,
          activeOnly: true 
        }) as { data: ProductWithDetails[]; total: number }
      } catch {
        return { data: getMockProducts(), total: getMockProducts().length }
      }
    },
  })

  // Fetch categories, brands, units for dropdowns
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try { return await invoke('list_categories') as Category[] } 
      catch { return getMockCategories() }
    },
  })
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      try { return await invoke('list_brands') as Brand[] } 
      catch { return getMockBrands() }
    },
  })
  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      try { return await invoke('list_units') as Unit[] } 
      catch { return getMockUnits() }
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (product: any) => invoke('create_product', product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created')
      setShowModal(false)
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (product: any) => invoke('update_product', product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated')
      setShowModal(false)
      setEditingProduct(null)
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_product', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
  })

  const handleSubmit = (data: any) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  const openEdit = (product: ProductWithDetails) => {
    setEditingProduct(product)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingProduct(null)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage products, variants, categories, brands & units</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" aria-label="Product tabs">
          {[
            { id: 'list', label: 'Products', icon: Package },
            { id: 'variants', label: 'Variants', icon: Tag },
            { id: 'categories', label: 'Categories', icon: Box },
            { id: 'brands', label: 'Brands', icon: Tag },
            { id: 'units', label: 'Units', icon: RotateCcw },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              className="gap-2"
              onClick={() => setActiveTab(tab.id as any)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </nav>
      </div>

      {/* Product List Tab */}
      {activeTab === 'list' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>All Products</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                    className="pl-10 w-64"
                  />
                </div>
                <Button variant="outline" onClick={() => toast.info('Export feature coming soon')}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button variant="outline" onClick={() => toast.info('Import feature coming soon')}>
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-3 font-medium text-gray-500">Barcode</th>
                        <th className="text-left p-3 font-medium text-gray-500">SKU</th>
                        <th className="text-left p-3 font-medium text-gray-500">Name</th>
                        <th className="text-left p-3 font-medium text-gray-500">Category</th>
                        <th className="text-left p-3 font-medium text-gray-500">Brand</th>
                        <th className="text-right p-3 font-medium text-gray-500">Purchase</th>
                        <th className="text-right p-3 font-medium text-gray-500">Sale</th>
                        <th className="text-right p-3 font-medium text-gray-500">Stock</th>
                        <th className="text-center p-3 font-medium text-gray-500">GST</th>
                        <th className="text-center p-3 font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsData?.data.map((product) => (
                        <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-600 font-mono">{product.barcode || '-'}</td>
                          <td className="p-3 text-sm text-gray-600 font-mono">{product.sku}</td>
                          <td className="p-3 text-sm font-medium text-gray-900">{product.name}</td>
                          <td className="p-3 text-sm text-gray-500">{product.category_name}</td>
                          <td className="p-3 text-sm text-gray-500">{product.brand_name || '-'}</td>
                          <td className="p-3 text-sm text-gray-900 text-right">{formatCurrency(product.purchase_price)}</td>
                          <td className="p-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(product.sale_price)}</td>
                          <td className="p-3 text-sm text-right">
                            <span className={product.current_stock <= product.reorder_level ? 'text-red-600 font-medium' : 'text-gray-900'}>
                              {product.current_stock} {product.unit_short_name}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-center text-gray-500">{product.gst_rate}%</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(product)} title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(product.id)} title="Delete" className="text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {productsData && productsData.total > pageSize && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                      Showing {Math.min((page - 1) * pageSize + 1, productsData.total)} to {Math.min(page * pageSize, productsData.total)} of {productsData.total}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= productsData.total}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Other tabs placeholder */}
      {['variants', 'categories', 'brands', 'units'].includes(activeTab) && (
        <Card>
          <CardHeader>
            <CardTitle>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <p>{activeTab} management coming soon...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories || []}
          brands={brands || []}
          units={units || []}
          onClose={() => { setShowModal(false); setEditingProduct(null) }}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

function ProductModal({ 
  product, 
  categories, 
  brands, 
  units, 
  onClose, 
  onSubmit, 
  isLoading 
}: {
  product: ProductWithDetails | null
  categories: Category[]
  brands: Brand[]
  units: Unit[]
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    barcode: '',
    sku: '',
    name: '',
    category_id: '',
    brand_id: '',
    unit_id: '',
    purchase_price: 0,
    sale_price: 0,
    min_sale_price: '',
    mrp: '',
    gst_rate: 18,
    hsn_code: '',
    reorder_level: 10,
    max_stock_level: '',
    track_expiry: false,
    track_batch: false,
    track_serial: false,
  })

  useState(() => {
    if (product) {
      setFormData({
        barcode: product.barcode || '',
        sku: product.sku,
        name: product.name,
        category_id: String(product.category_id),
        brand_id: String(product.brand_id || ''),
        unit_id: String(product.unit_id),
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        min_sale_price: String(product.min_sale_price || ''),
        mrp: String(product.mrp || ''),
        gst_rate: product.gst_rate,
        hsn_code: product.hsn_code || '',
        reorder_level: product.reorder_level,
        max_stock_level: String(product.max_stock_level || ''),
        track_expiry: product.track_expiry,
        track_batch: product.track_batch,
        track_serial: product.track_serial,
      })
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      category_id: Number(formData.category_id),
      brand_id: formData.brand_id ? Number(formData.brand_id) : null,
      unit_id: Number(formData.unit_id),
      purchase_price: Number(formData.purchase_price),
      sale_price: Number(formData.sale_price),
      min_sale_price: formData.min_sale_price ? Number(formData.min_sale_price) : null,
      mrp: formData.mrp ? Number(formData.mrp) : null,
      gst_rate: Number(formData.gst_rate),
      reorder_level: Number(formData.reorder_level),
      max_stock_level: formData.max_stock_level ? Number(formData.max_stock_level) : null,
      track_expiry: formData.track_expiry,
      track_batch: formData.track_batch,
      track_serial: formData.track_serial,
    }
    onSubmit(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmitForm}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{product ? 'Edit Product' : 'Add Product'}</h3>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="label">Barcode</label>
                <Input name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Auto-generated if empty" />
              </div>
              <div className="space-y-2">
                <label className="label">SKU *</label>
                <Input name="sku" value={formData.sku} onChange={handleChange} required />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="label">Product Name *</label>
                <Input name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <label className="label">Category *</label>
                <select name="category_id" value={formData.category_id} onChange={handleChange} className="input" required>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">Brand</label>
                <select name="brand_id" value={formData.brand_id} onChange={handleChange} className="input">
                  <option value="">Select brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">Unit *</label>
                <select name="unit_id" value={formData.unit_id} onChange={handleChange} className="input" required>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">Purchase Price</label>
                <Input type="number" step="0.01" name="purchase_price" value={formData.purchase_price} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="label">Sale Price *</label>
                <Input type="number" step="0.01" name="sale_price" value={formData.sale_price} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <label className="label">Min Sale Price</label>
                <Input type="number" step="0.01" name="min_sale_price" value={formData.min_sale_price} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="label">MRP</label>
                <Input type="number" step="0.01" name="mrp" value={formData.mrp} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="label">GST Rate %</label>
                <select name="gst_rate" value={formData.gst_rate} onChange={handleChange} className="input">
                  {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">HSN Code</label>
                <Input name="hsn_code" value={formData.hsn_code} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="label">Reorder Level</label>
                <Input type="number" name="reorder_level" value={formData.reorder_level} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="label">Max Stock Level</label>
                <Input type="number" name="max_stock_level" value={formData.max_stock_level} onChange={handleChange} />
              </div>
            </div>
            
            <div className="flex items-center gap-4 border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="track_expiry" checked={formData.track_expiry} onChange={handleChange} className="rounded" />
                <span className="text-sm">Track Expiry</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="track_batch" checked={formData.track_batch} onChange={handleChange} className="rounded" />
                <span className="text-sm">Track Batch</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="track_serial" checked={formData.track_serial} onChange={handleChange} className="rounded" />
                <span className="text-sm">Track Serial</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : (product ? 'Update' : 'Create')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Mock data functions
function getMockProducts(): ProductWithDetails[] {
  return [
    { id: 1, barcode: '8901234567890', sku: 'AMUL-MLK-1L', name: 'Amul Milk 1L', category_id: 1, brand_id: 1, unit_id: 1, purchase_price: 52, sale_price: 60, min_sale_price: 55, mrp: 62, gst_rate: 0, hsn_code: '0401', reorder_level: 50, max_stock_level: 200, track_expiry: true, track_batch: true, track_serial: false, is_active: true, created_at: '', updated_at: '', category_name: 'Dairy', brand_name: 'Amul', unit_name: 'Pieces', unit_short_name: 'pcs', current_stock: 120 },
    { id: 2, barcode: '8901234567891', sku: 'BRIT-BRD-400', name: 'Britannia Bread 400g', category_id: 2, brand_id: 2, unit_id: 1, purchase_price: 35, sale_price: 40, min_sale_price: 38, mrp: 42, gst_rate: 0, hsn_code: '1905', reorder_level: 30, max_stock_level: 100, track_expiry: true, track_batch: true, track_serial: false, is_active: true, created_at: '', updated_at: '', category_name: 'Bakery', brand_name: 'Britannia', unit_name: 'Pieces', unit_short_name: 'pcs', current_stock: 45 },
    { id: 3, barcode: '8901234567892', sku: 'PARL-G-100', name: 'Parle-G Biscuits 100g', category_id: 3, brand_id: 3, unit_id: 1, purchase_price: 8, sale_price: 10, min_sale_price: 9, mrp: 10, gst_rate: 18, hsn_code: '1905', reorder_level: 100, max_stock_level: 500, track_expiry: true, track_batch: true, track_serial: false, is_active: true, created_at: '', updated_at: '', category_name: 'Biscuits', brand_name: 'Parle', unit_name: 'Pieces', unit_short_name: 'pcs', current_stock: 300 },
  ]
}

function getMockCategories(): Category[] {
  return [
    { id: 1, name: 'Dairy', parent_id: null, gst_rate: 0, hsn_code: '0401', description: '', is_active: true, created_at: '', updated_at: '' },
    { id: 2, name: 'Bakery', parent_id: null, gst_rate: 0, hsn_code: '1905', description: '', is_active: true, created_at: '', updated_at: '' },
    { id: 3, name: 'Biscuits', parent_id: null, gst_rate: 18, hsn_code: '1905', description: '', is_active: true, created_at: '', updated_at: '' },
    { id: 4, name: 'Beverages', parent_id: null, gst_rate: 28, hsn_code: '2202', description: '', is_active: true, created_at: '', updated_at: '' },
  ]
}

function getMockBrands(): Brand[] {
  return [
    { id: 1, name: 'Amul', description: '', is_active: true, created_at: '' },
    { id: 2, name: 'Britannia', description: '', is_active: true, created_at: '' },
    { id: 3, name: 'Parle', description: '', is_active: true, created_at: '' },
    { id: 4, name: 'Tata', description: '', is_active: true, created_at: '' },
  ]
}

function getMockUnits(): Unit[] {
  return [
    { id: 1, name: 'Pieces', short_name: 'pcs', type: 'count', decimals: 0, is_active: true },
    { id: 2, name: 'Kilogram', short_name: 'kg', type: 'weight', decimals: 3, is_active: true },
    { id: 3, name: 'Liter', short_name: 'L', type: 'volume', decimals: 3, is_active: true },
  ]
}

import { X } from 'lucide-react'