"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileText } from "lucide-react"
import { getAdminDashboardData } from "@/app/actions/admin"
import { format } from "date-fns"
import { de } from "date-fns/locale"

interface ExportButtonProps {
  startDate: string
  endDate: string
}

export function ExportButton({ startDate, endDate }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToCSV = async () => {
    setIsExporting(true)
    try {
      const data = await getAdminDashboardData(startDate, endDate)

      // CSV Header
      const headers = ["Mitarbeiter", "E-Mail", "Datum", "Stunden", "Projekt", "Beschreibung"]
      const rows = data.entries.map((entry) => [
        entry.user?.name || "",
        entry.user?.email || "",
        format(new Date(entry.date), "dd.MM.yyyy", { locale: de }),
        entry.hours.toString().replace(".", ","),
        entry.projects?.name || "",
        entry.description?.replace(/"/g, '""') || "",
      ])

      const csvContent = [headers.join(";"), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";"))].join("\n")

      // Download
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `zeiterfassung_${format(new Date(startDate), "yyyy-MM")}.csv`
      link.click()
    } catch (error) {
      console.error("Export-Fehler:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const exportSummaryToCSV = async () => {
    setIsExporting(true)
    try {
      const data = await getAdminDashboardData(startDate, endDate)

      // CSV Header für Zusammenfassung
      const headers = ["Mitarbeiter", "E-Mail", "Rolle", "Gesamtstunden", "Anzahl Einträge", "Überstunden-Saldo"]
      const rows = data.users.map((user) => [
        user.name,
        user.email,
        user.role === "admin" ? "Admin" : "Mitarbeiter",
        user.totalHours.toFixed(2).replace(".", ","),
        user.entriesCount.toString(),
        (user.overtimeBalance ?? 0).toFixed(2).replace(".", ","),
      ])

      const csvContent = [headers.join(";"), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";"))].join("\n")

      // Download
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `zeiterfassung_zusammenfassung_${format(new Date(startDate), "yyyy-MM")}.csv`
      link.click()
    } catch (error) {
      console.error("Export-Fehler:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exportiere..." : "Exportieren"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Alle Einträge (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportSummaryToCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Zusammenfassung (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
