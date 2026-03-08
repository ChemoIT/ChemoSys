'use client'

/**
 * VehicleOwnershipJournal — Monthly costs activity journal sub-component.
 *
 * Used inside VehicleOwnershipSection (Tab 2 of VehicleCard).
 *
 * Rules:
 *   - One active record per vehicle at a time (endDate === null = current rate).
 *   - NO delete button — cost records are an immutable financial audit trail.
 *   - Add form: calls addVehicleMonthlyCost (closes previous active + inserts new).
 *   - Edit form: calls updateVehicleMonthlyCost (correction of existing record).
 *   - After mutation: revalidatePath fires on server → costs list refreshes on next render.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FleetDateInput } from '@/components/app/fleet/shared/FleetDateInput'
import {
  addVehicleMonthlyCost,
  updateVehicleMonthlyCost,
} from '@/actions/fleet/vehicle-ownership'
import { formatDate } from '@/lib/format'
import type { VehicleMonthlyCost } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type VehicleOwnershipJournalProps = {
  vehicleId: string
  costs: VehicleMonthlyCost[]
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleOwnershipJournal({
  vehicleId,
  costs: initialCosts,
}: VehicleOwnershipJournalProps) {
  const [costs, setCosts] = useState<VehicleMonthlyCost[]>(initialCosts)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [isPendingAdd, startAddTransition] = useTransition()
  const [isPendingEdit, startEditTransition] = useTransition()

  // Active record = end_date IS NULL
  const activeCost = costs.find((c) => c.endDate === null)
  const historyCosts = costs.filter((c) => c.endDate !== null)

  // ─────────────────────────────────────────────────────────
  // Form helpers
  // ─────────────────────────────────────────────────────────

  function resetForm() {
    setAmount('')
    setStartDate('')
    setEndDate('')
  }

  function openAddForm() {
    setEditingId(null)
    resetForm()
    setShowAddForm(true)
  }

  function openEditForm(cost: VehicleMonthlyCost) {
    setShowAddForm(false)
    setEditingId(cost.id)
    setAmount(cost.amount.toString())
    setStartDate(cost.startDate)
    setEndDate(cost.endDate ?? '')
  }

  function cancelForm() {
    setEditingId(null)
    setShowAddForm(false)
    resetForm()
  }

  // ─────────────────────────────────────────────────────────
  // Add
  // ─────────────────────────────────────────────────────────

  function handleAdd() {
    const parsedAmount = parseFloat(amount)
    if (!startDate) {
      toast.error('יש לבחור תאריך התחלה')
      return
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('יש להזין סכום חיובי')
      return
    }

    startAddTransition(async () => {
      const result = await addVehicleMonthlyCost({
        vehicleId,
        startDate,
        amount: parsedAmount,
      })

      if (result.success && result.id) {
        // Close previous active record locally
        const newCosts = costs.map((c) =>
          c.endDate === null ? { ...c, endDate: startDate } : c
        )
        // Add new active record
        const newRecord: VehicleMonthlyCost = {
          id: result.id,
          vehicleId,
          startDate,
          endDate: null,
          amount: parsedAmount,
          createdAt: new Date().toISOString(),
        }
        setCosts([newRecord, ...newCosts])
        resetForm()
        setShowAddForm(false)
        toast.success('העלות החודשית עודכנה')
      } else {
        toast.error(result.error ?? 'שגיאה בהוספת עלות')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Edit
  // ─────────────────────────────────────────────────────────

  function handleEdit() {
    if (!editingId) return
    const parsedAmount = parseFloat(amount)
    if (!startDate) {
      toast.error('יש לבחור תאריך התחלה')
      return
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('יש להזין סכום חיובי')
      return
    }

    startEditTransition(async () => {
      const result = await updateVehicleMonthlyCost({
        costId: editingId,
        vehicleId,
        startDate,
        endDate: endDate || null,
        amount: parsedAmount,
      })

      if (result.success) {
        setCosts((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? { ...c, startDate, endDate: endDate || null, amount: parsedAmount }
              : c
          )
        )
        setEditingId(null)
        resetForm()
        toast.success('הרשומה עודכנה')
      } else {
        toast.error(result.error ?? 'שגיאה בעדכון רשומה')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Form render
  // ─────────────────────────────────────────────────────────

  const inputClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'

  function renderForm(mode: 'add' | 'edit') {
    const isPending = mode === 'add' ? isPendingAdd : isPendingEdit

    return (
      <div className="border rounded-xl p-4 space-y-4 bg-muted/20">

        {/* סכום */}
        <div className="space-y-1.5">
          <Label>סכום חודשי (₪) *</Label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>

        {/* תאריך התחלה */}
        <div className="space-y-1.5">
          <Label>תאריך התחלה *</Label>
          <FleetDateInput
            value={startDate}
            onChange={setStartDate}
            minYear={2000}
          />
        </div>

        {/* תאריך סיום (רק בעריכה) */}
        {mode === 'edit' && (
          <div className="space-y-1.5">
            <Label>תאריך סיום (ריק = פעיל)</Label>
            <FleetDateInput
              value={endDate}
              onChange={setEndDate}
              minYear={2000}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={cancelForm}>
            ביטול
          </Button>
          <Button
            size="sm"
            onClick={mode === 'add' ? handleAdd : handleEdit}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            {mode === 'add' ? (
              <>
                <Plus className="h-4 w-4 ms-1" />
                הוסף שינוי עלות
              </>
            ) : (
              <>שמור שינויים</>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="space-y-4">

      {/* Current active rate — displayed prominently */}
      {activeCost ? (
        <div
          className="rounded-xl p-4 flex items-start justify-between gap-3"
          style={{ background: '#EAF6F1', border: '1px solid #A7D9C3' }}
        >
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-teal-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800">
                עלות נוכחית: ₪{activeCost.amount.toLocaleString('he-IL')}/חודש
              </p>
              <p className="text-xs text-teal-700 mt-0.5">
                מתאריך: {formatDate(activeCost.startDate)}
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full shrink-0">
            פעיל
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">לא הוגדרה עלות חודשית</p>
      )}

      {/* History list */}
      {historyCosts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium mb-2">היסטוריה</p>
          {historyCosts.map((cost) => {
            const isEditing = editingId === cost.id
            if (isEditing) {
              return <div key={cost.id}>{renderForm('edit')}</div>
            }

            return (
              <div
                key={cost.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 border rounded-lg hover:bg-muted/20 transition-colors group"
                style={{ borderColor: '#E2EBF4' }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 text-sm">
                  <span className="font-medium text-foreground">
                    ₪{cost.amount.toLocaleString('he-IL')}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(cost.startDate)}
                    {cost.endDate ? ` ← ${formatDate(cost.endDate)}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => openEditForm(cost)}
                  className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                  title="ערוך"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm && renderForm('add')}

      {/* Add button */}
      {!showAddForm && !editingId && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={openAddForm}
        >
          <Plus className="h-4 w-4" />
          הוסף שינוי עלות
        </Button>
      )}
    </div>
  )
}
