'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RefreshButton() {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)

  function handleRefresh() {
    setSpinning(true)
    router.refresh()
    // Stop animation after 600ms (enough for visual feedback)
    setTimeout(() => setSpinning(false), 600)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleRefresh}
      title="רענן נתונים"
      className="h-8 w-8"
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
    </Button>
  )
}
