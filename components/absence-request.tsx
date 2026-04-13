"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, Plus, X } from "lucide-react"
import { requestAbsence } from "@/app/actions/absences"
import { useRouter } from "next/navigation"

export function AbsenceRequest() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<"vacation" | "sick" | "other">("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.set("type", type)
      formData.set("start_date", startDate)
      formData.set("end_date", endDate)
      formData.set("reason", reason)

      await requestAbsence(formData)
      setMessage({ type: "success", text: "Abwesenheit beantragt!" })
      setStartDate("")
      setEndDate("")
      setReason("")
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Beantragen" })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Abwesenheit beantragen
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Abwesenheit beantragen
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Art der Abwesenheit</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="vacation">Urlaub</option>
              <option value="sick">Krankheit</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Von</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Bis</Label>
              <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Grund (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Optional"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success" ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              Beantragen
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
