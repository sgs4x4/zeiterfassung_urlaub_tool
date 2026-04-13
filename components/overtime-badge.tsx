"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { getOvertimeBalance } from "@/app/actions/time-entries"

export function OvertimeBadge() {
  const [overtime, setOvertime] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadOvertime = async () => {
    try {
      const balance = await getOvertimeBalance()
      setOvertime(balance)
    } catch (error) {
      console.error("Error loading overtime:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOvertime()

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadOvertime()
      }
    }, 30000) // Update alle 30 Sekunden

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-primary" />
            Überstunden-Saldo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Lade...</div>
        </CardContent>
      </Card>
    )
  }

  const isPositive = overtime && overtime > 0
  const isNegative = overtime && overtime < 0
  const isZero = overtime === 0

  return (
    <Card className={isPositive ? "border-green-500/50" : isNegative ? "border-red-500/50" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-primary" />
          Überstunden-Saldo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPositive && <TrendingUp className="h-5 w-5 text-green-500" />}
            {isNegative && <TrendingDown className="h-5 w-5 text-red-500" />}
            {isZero && <Minus className="h-5 w-5 text-muted-foreground" />}
            <span
              className={`text-3xl font-bold ${
                isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground"
              }`}
            >
              {overtime !== null ? (overtime > 0 ? "+" : "") + overtime.toFixed(2) : "-"}
            </span>
            <span className="text-lg text-muted-foreground">h</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Kumuliert seit Beginn der Erfassung</p>
      </CardContent>
    </Card>
  )
}
