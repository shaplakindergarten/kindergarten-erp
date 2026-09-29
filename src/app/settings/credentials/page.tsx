'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Search, RefreshCw } from 'lucide-react'

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const fetchCredentials = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter !== 'all') params.set('role', roleFilter)

      const res = await fetch(`/api/admin/credentials?${params}`)
      const data = await res.json()
      setCredentials(data.credentials || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCredentials() }, [search, roleFilter])

  const handleDownload = (format: 'csv' | 'txt') => {
    const content = format === 'csv'
      ? ['Name,Email,Password,Role,Entity Type',
         ...credentials.map(c => 
           `"${c.full_name}","${c.email}","${c.password}","${c.role}","${c.entity_type}"`
         )].join('\n')
      : credentials.map(c => 
          `Name: ${c.full_name}\nEmail: ${c.email}\nPassword: ${c.password}\nRole: ${c.role}\n---`
        ).join('\n\n')

    const blob = new Blob([content], { 
      type: format === 'csv' ? 'text/csv' : 'text/plain' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credentials-${new Date().toISOString().split('T')[0]}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Account Credentials</h1>
        <div className="flex gap-2">
          <Button onClick={fetchCredentials} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => handleDownload('csv')}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button onClick={() => handleDownload('txt')} variant="outline">
            <Download className="h-4 w-4 mr-2" /> TXT
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-10 px-3 rounded-lg border"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="staff">Staff</option>
          <option value="student">Student</option>
          <option value="accountant">Accountant</option>
          <option value="store">Store</option>
        </select>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Password</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Downloaded</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.full_name}</td>
                  <td className="p-3 font-mono text-sm">{c.email}</td>
                  <td className="p-3 font-mono text-sm">{c.password}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded bg-slate-100 text-xs">
                      {c.role}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-slate-500">
                    {c.is_downloaded ? `✅ ${c.download_count || 0}x` : '⏳ Never'}
                  </td>
                </tr>
              ))}
              {credentials.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No credentials found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}