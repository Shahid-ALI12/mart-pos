// modules/users/index.tsx — User management + roles + activity log
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Plus, X, Shield } from 'lucide-react'
import { formatDateTime } from '@/shared/utils'
import type { UserWithRole, Role } from '@/shared/types'

export function UserManagement() {
  const [page] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserWithRole | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: async () => {
      const res = await invoke<{ data: UserWithRole[]; total: number; page: number; total_pages: number }>(
        'list_users', { pageSize: 50 }
      )
      return res
    },
  })

  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (id: number) => invoke('delete_user', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User archived') },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">User Management</h1><p className="text-gray-500">Manage system users</p></div>
        <Button className="gap-2" onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="w-4 h-4" /> Add User</Button>
      </div>
      {showForm && <UserForm user={editing} onClose={() => setShowForm(false)} />}
      <Card>
        <CardHeader><CardTitle>System Users ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-gray-500 text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">No users</TableCell></TableRow>}
                {data?.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{u.name}</TableCell>
                    <TableCell><Badge>{u.role_name}</Badge></TableCell>
                    <TableCell>{u.last_login ? formatDateTime(u.last_login) : '—'}</TableCell>
                    <TableCell>{u.is_active ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setShowForm(true) }}>Edit</Button>
                      {u.id !== 1 && <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(u.id)}>Delete</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UserForm({ user, onClose }: { user: UserWithRole | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: roles } = useQuery<Role[]>({ queryKey: ['roles'], queryFn: () => invoke('get_roles') })

  const [username, setUsername] = useState(user?.username || '')
  const [name, setName] = useState(user?.name || '')
  const [roleId, setRoleId] = useState(user?.role_id ?? roles?.[0]?.id ?? 3)
  const [phone, setPhone] = useState(user?.phone || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)

  const mut = useMutation({
    mutationFn: async () => {
      if (user) {
        await invoke('update_user', { input: { id: user.id, name, roleId, phone: phone || null, email: email || null, isActive, newPassword: password || null } })
      } else {
        await invoke('create_user', { input: { username, password, name, roleId, phone: phone || null, email: email || null, isActive: true } })
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(user ? 'User updated' : 'User created'); onClose() },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{user ? 'Edit User' : 'New User'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user && <div><Label>Username *</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>}
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Role</Label>
            <select className="w-full rounded border px-3 py-2" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
              {roles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div><Label>{user ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {user && (
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="active" />
              <label htmlFor="active">Active</label>
            </div>
          )}
          <Button className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending || !name.trim() || (!user && !password)}>{mut.isPending ? 'Saving...' : 'Save'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function RolePermissions() {
  const { data: roles } = useQuery<Role[]>({ queryKey: ['roles'], queryFn: () => invoke('get_roles') })
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Shield className="w-6 h-6" /> Role Permissions</h1>
      <Card>
        <CardHeader><CardTitle>Roles & Permissions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Description</TableHead><TableHead>Permissions</TableHead></TableRow></TableHeader>
            <TableBody>
              {roles?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.description || '—'}</TableCell>
                  <TableCell><code className="text-xs">{r.permissions}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function ActivityLog() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6">Activity Log</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Activity log view — coming when the backend audit log has UI-side filtering.</p></CardContent></Card></div>
}
