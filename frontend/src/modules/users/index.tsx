import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Plus, Shield, History, Users } from 'lucide-react'

export function UserManagement() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-500">Manage system users and access</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add User</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>System Users</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">User Management module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function RolePermissions() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Role Permissions</h1>
          <p className="text-gray-500">Configure role-based access control</p>
        </div>
        <Button className="gap-2"><Shield className="w-4 h-4" /> Manage Roles</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Roles & Permissions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Role Permissions module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function ActivityLog() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-gray-500">Audit trail of all system activities</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Activity Log module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}