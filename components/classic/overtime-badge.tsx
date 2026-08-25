"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useOvertimeBalance } from "@/hooks/queries/use-overtime-balance"

export function OvertimeBadge() {
  const { data: overtime, isLoading } = useOvertimeBalance()

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

  const isPositive = overtime !== undefined && overtime > 0
  const isNegative = overtime !== undefined && overtime < 0
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
              {overtime !== undefined ? (overtime > 0 ? "+" : "") + overtime.toFixed(2) : "-"}
            </span>
            <span className="text-lg text-muted-foreground">h</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Kumuliert seit Beginn der Erfassung</p>
      </CardContent>
    </Card>
  )
}
