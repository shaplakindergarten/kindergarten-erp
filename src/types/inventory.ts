export type ItemType = 'asset' | 'consumable' | 'saleable'

export type PurchaseStatus = 'pending' | 'received' | 'cancelled'

export type IssueStatus = 'pending' | 'issued' | 'cancelled'

export type SaleStatus = 'completed' | 'cancelled' | 'returned'

export interface InventoryCategory {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface InventorySupplier {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email?: string | null
  address?: string | null
  current_due: number
  created_at?: string
  updated_at?: string
}

export interface InventoryItem {
  id: string
  item_code: string
  name: string
  category_id: string | null
  item_type: ItemType
  unit: string
  purchase_price: number
  selling_price: number
  current_stock: number
  reorder_level: number
  location_rack?: string | null
  category?: InventoryCategory
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface InventoryPurchase {
  id: string
  purchase_no: string
  supplier_id: string | null
  purchase_date: string
  total_amount: number
  status: PurchaseStatus
  narration?: string | null
  supplier?: InventorySupplier
  items: InventoryPurchaseItem[]
  created_at?: string
  updated_at?: string
}

export interface InventoryPurchaseItem {
  id: string
  purchase_id: string
  item_id: string
  quantity: number
  purchase_price: number
  total_price: number
  item?: InventoryItem
  created_at?: string
  updated_at?: string
}

export interface InventoryIssuance {
  id: string
  issuance_no: string
  item_id: string
  item_type: ItemType
  issued_to_type: 'staff' | 'student'
  issued_to_id: string
  issued_to_name: string
  quantity: number
  unit: string
  issuance_date: string
  purpose?: string | null
  status: IssueStatus
  item?: InventoryItem
  created_at?: string
  updated_at?: string
}

export interface InventorySale {
  id: string
  sale_no: string
  student_id?: string | null
  sale_date: string
  total_amount: number
  status: SaleStatus
  narration?: string | null
  student?: { id: string; name: string; student_id: string }
  items: InventorySaleItem[]
  created_at?: string
  updated_at?: string
}

export interface InventorySaleItem {
  id: string
  sale_id: string
  item_id: string
  quantity: number
  selling_price: number
  total_price: number
  item?: InventoryItem
  created_at?: string
  updated_at?: string
}

export interface StockValuation {
  item_id: string
  item_code: string
  name: string
  category_name: string
  purchase_price: number
  current_stock: number
  total_value: number
  location_rack?: string | null
}

export interface LowStockAlert {
  item_id: string
  item_code: string
  name: string
  current_stock: number
  reorder_level: number
  shortage_qty: number
  category_name: string
}

export interface AssetValuation {
  total_assets: number
  total_consumable: number
  total_saleable: number
  total_stock_value: number
  item_count: number
}