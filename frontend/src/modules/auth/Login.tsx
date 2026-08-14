import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, Building2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../shared/components/ui/button'
import { Input } from '../../shared/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../shared/components/ui/card'
import toast from 'react-hot-toast'

export function Login() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err: any) {
      const message = err?.message || 'Invalid username or password'
      setError(message)
      toast.error(message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Mart POS</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="username" className="label">Username</label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Default login: <code className="bg-gray-100 px-1 rounded">admin</code> / <code className="bg-gray-100 px-1 rounded">admin123</code></p>
            <p className="mt-1">Change password on first login</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}