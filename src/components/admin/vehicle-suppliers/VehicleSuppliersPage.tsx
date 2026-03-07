'use client'

/**
 * VehicleSuppliersPage — client component for Vehicle Supplier CRUD.
 *
 * Features:
 *   - Type filter buttons (הכל + per supplier type)
 *   - DataTable with columns: type badge, name, contact, phone, email, active, actions
 *   - Add/Edit dialog (SupplierFormDialog — reused for both modes)
 *   - Soft-delete via DeleteConfirmDialog
 *   - Toggle is_active with optimistic toast
 *   - Fully responsive (mobile: hidden columns, scrollable dialog)
 */

import * as React from 'react'
import { startTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import type { VehicleSupplier } from '@/lib/fleet/supplier-types'
import { SUPPLIER_TYPE_LABELS } from '@/lib/fleet/supplier-types'
import {
  createVehicleSupplier,
  updateVehicleSupplier,
  deleteVehicleSupplier,
  toggleSupplierActive,
} from '@/actions/fleet/vehicle-suppliers'
import { formatPhone } from '@/lib/format'

import { DataTable } from '@/components/shared/DataTable'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Badge colors per supplier type
// ---------------------------------------------------------------------------
const TYPE_BADGE_CLASSES: Record<string, string> = {
  leasing:   'bg-blue-100 text-blue-800 border-blue-200',
  insurance: 'bg-purple-100 text-purple-800 border-purple-200',
  fuel_card: 'bg-amber-100 text-amber-800 border-amber-200',
  garage:    'bg-green-100 text-green-800 border-green-200',
  other:     'bg-gray-100 text-gray-700 border-gray-200',
}

// ---------------------------------------------------------------------------
// SupplierFormDialog — Add / Edit dialog (reused for both modes)
// ---------------------------------------------------------------------------

interface SupplierFormDialogProps {
  open: boolean
  onClose: () => void
  supplier?: VehicleSupplier
}

function SupplierFormDialog({ open, onClose, supplier }: SupplierFormDialogProps) {
  const isEdit = !!supplier
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [supplierType, setSupplierType] = React.useState<string>(supplier?.supplier_type ?? '')

  // Sync supplierType when supplier changes (e.g. opening edit for different supplier)
  React.useEffect(() => {
    setSupplierType(supplier?.supplier_type ?? '')
    setError(null)
  }, [supplier, open])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    // Inject the Select value (not a native input)
    formData.set('supplier_type', supplierType)

    startTransition(() => {
      const action = isEdit
        ? updateVehicleSupplier(supplier!.id, formData)
        : createVehicleSupplier(formData)

      action.then((result) => {
        setLoading(false)
        if (result.success) {
          toast.success(isEdit ? 'הספק עודכן בהצלחה' : 'הספק נוסף בהצלחה')
          onClose()
        } else {
          setError(result.error ?? 'שגיאה לא ידועה')
        }
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'עריכת ספק רכב' : 'הוספת ספק רכב'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier type */}
          <div className="space-y-1">
            <Label htmlFor="supplier_type">סוג ספק <span className="text-destructive">*</span></Label>
            <Select value={supplierType} onValueChange={setSupplierType} required>
              <SelectTrigger id="supplier_type" className="text-base w-full">
                <SelectValue placeholder="בחר סוג ספק" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUPPLIER_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">שם ספק <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              name="name"
              className="text-base"
              defaultValue={supplier?.name ?? ''}
              required
              placeholder="שם החברה / המוסך"
            />
          </div>

          {/* Contact name */}
          <div className="space-y-1">
            <Label htmlFor="contact_name">איש קשר</Label>
            <Input
              id="contact_name"
              name="contact_name"
              className="text-base"
              defaultValue={supplier?.contact_name ?? ''}
              placeholder="שם איש קשר"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              className="text-base"
              defaultValue={supplier?.phone ?? ''}
              placeholder="03-1234567 / 052-0000000"
              dir="ltr"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              name="email"
              type="email"
              className="text-base"
              defaultValue={supplier?.email ?? ''}
              placeholder="contact@supplier.co.il"
              dir="ltr"
            />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <Label htmlFor="address">כתובת</Label>
            <Input
              id="address"
              name="address"
              className="text-base"
              defaultValue={supplier?.address ?? ''}
              placeholder="רחוב, עיר"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              name="notes"
              className="text-base resize-none"
              rows={3}
              defaultValue={supplier?.notes ?? ''}
              placeholder="הערות חופשיות..."
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading || !supplierType}>
              {loading ? 'שומר...' : isEdit ? 'עדכן ספק' : 'הוסף ספק'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// VehicleSuppliersPage — main page component
// ---------------------------------------------------------------------------

interface VehicleSuppliersPageProps {
  initialSuppliers: VehicleSupplier[]
}

export function VehicleSuppliersPage({ initialSuppliers }: VehicleSuppliersPageProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingSupplier, setEditingSupplier] = React.useState<VehicleSupplier | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<VehicleSupplier | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [filterType, setFilterType] = React.useState<string>('') // '' = all

  // Client-side filter by type
  const filteredSuppliers = filterType
    ? initialSuppliers.filter((s) => s.supplier_type === filterType)
    : initialSuppliers

  function openCreate() {
    setEditingSupplier(undefined)
    setFormOpen(true)
  }

  function openEdit(supplier: VehicleSupplier) {
    setEditingSupplier(supplier)
    setFormOpen(true)
  }

  function openDelete(supplier: VehicleSupplier) {
    setDeleteTarget(supplier)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteVehicleSupplier(deleteTarget.id)
      if (result.success) {
        toast.success('הספק נמחק בהצלחה')
      } else {
        toast.error(result.error ?? 'שגיאה במחיקת הספק')
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleToggleActive(supplier: VehicleSupplier) {
    const newValue = !supplier.is_active
    toast.promise(
      toggleSupplierActive(supplier.id, newValue),
      {
        loading: 'מעדכן סטטוס...',
        success: newValue ? 'הספק הוגדר כפעיל' : 'הספק הוגדר כלא פעיל',
        error: 'שגיאה בעדכון הסטטוס',
      }
    )
  }

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------
  const columns: ColumnDef<VehicleSupplier>[] = [
    {
      accessorKey: 'supplier_type',
      header: 'סוג ספק',
      cell: ({ row }) => {
        const type = row.original.supplier_type
        const label = SUPPLIER_TYPE_LABELS[type] ?? type
        const cls = TYPE_BADGE_CLASSES[type] ?? TYPE_BADGE_CLASSES.other
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>
            {label}
          </span>
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'שם ספק',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'contact_name',
      header: 'איש קשר',
      cell: ({ row }) => row.original.contact_name ?? '—',
      // Hidden on mobile
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      accessorKey: 'phone',
      header: 'טלפון',
      cell: ({ row }) => {
        const phone = row.original.phone
        if (!phone) return '—'
        // Try mobile format, otherwise show raw
        const formatted = formatPhone(phone)
        return formatted === '—' ? phone : formatted
      },
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      accessorKey: 'email',
      header: 'אימייל',
      cell: ({ row }) => row.original.email
        ? <span dir="ltr">{row.original.email}</span>
        : '—',
      meta: { className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'is_active',
      header: 'סטטוס',
      cell: ({ row }) => row.original.is_active
        ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">פעיל</Badge>
        : <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">לא פעיל</Badge>,
    },
    {
      id: 'actions',
      header: 'פעולות',
      cell: ({ row }) => {
        const supplier = row.original
        return (
          <div className="flex items-center gap-1">
            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEdit(supplier)}
              title="עריכה"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {/* Toggle active */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToggleActive(supplier)}
              title={supplier.is_active ? 'השבת ספק' : 'הפעל ספק'}
              className={supplier.is_active ? 'text-green-600' : 'text-muted-foreground'}
            >
              {supplier.is_active
                ? <ToggleRight className="h-4 w-4" />
                : <ToggleLeft className="h-4 w-4" />
              }
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDelete(supplier)}
              title="מחיקה"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">ספקי רכב</h1>
          <Badge variant="secondary">{initialSuppliers.length}</Badge>
        </div>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="me-2 h-4 w-4" />
          הוסף ספק
        </Button>
      </div>

      {/* Type filter buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterType === '' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('')}
          className="min-h-[36px]"
        >
          הכל
          <span className="ms-1.5 text-xs opacity-70">({initialSuppliers.length})</span>
        </Button>
        {Object.entries(SUPPLIER_TYPE_LABELS).map(([type, label]) => {
          const count = initialSuppliers.filter((s) => s.supplier_type === type).length
          return (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type === filterType ? '' : type)}
              className="min-h-[36px]"
            >
              {label}
              <span className="ms-1.5 text-xs opacity-70">({count})</span>
            </Button>
          )
        })}
      </div>

      {/* Empty state when filter yields no results */}
      {filteredSuppliers.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {filterType
              ? `לא נמצאו ספקים מסוג "${SUPPLIER_TYPE_LABELS[filterType]}"`
              : 'לא נמצאו ספקים. לחץ "הוסף ספק" להתחיל.'
            }
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredSuppliers}
          searchKey="name"
          searchPlaceholder="חיפוש לפי שם ספק..."
          onRowClick={openEdit}
        />
      )}

      {/* Add / Edit dialog */}
      <SupplierFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplier={editingSupplier}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת ספק רכב"
        description={`האם אתה בטוח שברצונך למחוק את הספק "${deleteTarget?.name}"? הרשומה תוסתר מהרשימה אך לא תימחק מהמסד.`}
      />
    </div>
  )
}
