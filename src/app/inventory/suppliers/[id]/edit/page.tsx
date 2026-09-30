"use client"

import { useState, useEffect } from "react"
import React from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Phone,
  Mail,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/currency-input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

interface InventorySupplier {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string | null
  address?: string | null
  current_due: number
  created_at?: string
  updated_at?: string
  status?: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function SupplierEditPage({ params }: PageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [companyName, setCompanyName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [currentDue, setCurrentDue] = useState(0)

  const resolvedParams = React.use(params)
  const supplierId = resolvedParams.id

  useEffect(() => {
    loadSupplier()
  }, [supplierId])

  const loadSupplier = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('*')
        .eq('id', supplierId)
        .single()

      if (error) throw error
      
      const supplier = data as InventorySupplier
      setCompanyName(supplier.company_name || '')
      setContactPerson(supplier.contact_person || '')
      setPhone(supplier.phone || '')
      setEmail(supplier.email || '')
      setAddress(supplier.address || '')
      setCurrentDue(supplier.current_due || 0)
    } catch (error) {
      console.error('Error loading supplier:', error)
      toast.error('Failed to load supplier')
      router.push('/inventory/suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!companyName || !phone) {
      toast.error('Please fill in required fields (Company Name, Phone)')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('inventory_suppliers').update({
        company_name: companyName,
        contact_person: contactPerson,
        phone: phone,
        email: email || null,
        address: address || null,
        current_due: currentDue
      }).eq('id', supplierId)

      if (error) throw error

      toast.success('Supplier updated successfully')
      router.push(`/inventory/suppliers/${supplierId}`)
    } catch (error) {
      console.error('Error updating supplier:', (error as any)?.message || error)
      toast.error('Failed to update supplier')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold font-heading">Edit Supplier</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edit Supplier Details</CardTitle>
            <CardDescription>Update supplier information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Contact person name"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone *</Label>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Supplier address"
                  rows={3}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="current_due">Opening Due / Balance (BDT)</Label>
                <CurrencyInput
                  value={currentDue}
                  onValueChange={setCurrentDue}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Supplier'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}