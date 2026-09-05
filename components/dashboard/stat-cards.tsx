"use client"

import type React from "react"

import { differenceInCalendarDays, endOfMonth } from "date-fns"
import { Area, AreaChart } from "recharts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn, formatHours } from "@/lib/utils"
import { useOvertimeBalance } from "@/hooks/queries/use-overtime-balance"
import { useOvertimeTrend } from "@/hooks/queries/use-overtime-trend"
import { useMonthData } from "@/hooks/queries/use-month-data"
import type { Bundesland } from "@/lib/holidays"
import { OvertimeAdjustments } from "./overtime-adjustments"

const TREND_CHART_CONFIG: ChartConfig = {
  delta: { label: "Saldo", color: "var(--chart-1)" },
}

function StatCard({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <Card className="gap-0 border-border/60 p-5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-3">{children}</div>
      {hint && <div className="mt-3 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}

interface StatCardsProps {
  monthlyHours: number
  bundesland: Bundesland
}

export function StatCards({ monthlyHours, bundesland }: StatCardsProps) {
  const { data: overtime, isLoading: isBalanceLoading } = useOvertimeBalance()
  const { data: trend } = useOvertimeTrend()

  const now = new Date()
  // Gleicher Query-Key wie die Monatsübersicht darunter → geteilter Cache, kein zweiter Request.
  const { data: monthData, isLoading: isMonthLoading } = useMonthData(
    now.getFullYear(),
    now.getMonth() + 1,
    bundesland,
  )
  const monthHours = (monthData?.entries ?? []).reduce((sum, e) => sum + Number(e.hours), 0)

  const daysLeft = differenceInCalendarDays(endOfMonth(now), now)
  const monthProgress = monthlyHours > 0 ? Math.min((monthHours / monthlyHours) * 100, 100) : 0
  const monthDelta = monthHours - monthlyHours

  const hasTrend = trend && trend.some((point) => point.delta !== 0)

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="Überstunden-Saldo"
        hint="Kumuliert seit Beginn der Erfassung"
      >
        {isBalanceLoading ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <div className="flex items-end justify-between gap-3">
            <span
              className={cn(
                "text-3xl font-semibold tabular-nums",
                overtime === undefined || overtime === 0
                  ? "text-foreground"
                  : overtime > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
              )}
            >
              {overtime !== undefined ? `${overtime > 0 ? "+" : ""}${overtime.toFixed(2)}` : "–"}
              <span className="ml-1 text-base font-normal text-muted-foreground">h</span>
            </span>

            {hasTrend && (
              <ChartContainer config={TREND_CHART_CONFIG} className="h-9 w-24 shrink-0">
                <AreaChart data={trend} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                  <Area
                    type="monotone"
                    dataKey="delta"
                    stroke="var(--color-delta)"
                    fill="var(--color-delta)"
                    fillOpacity={0.12}
                    strokeWidth={1.75}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        )}
        <OvertimeAdjustments className="mt-3" />
      </StatCard>

      <StatCard
        label="Dieser Monat"
        hint={
          <span>
            Noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"} · Soll {formatHours(monthlyHours)}
          </span>
        }
      >
        {isMonthLoading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{monthHours.toFixed(2)}</span>
              <span className="text-base text-muted-foreground tabular-nums">/ {monthlyHours} h</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${monthProgress}%` }}
              />
            </div>
          </>
        )}
      </StatCard>

      <StatCard label="Differenz zum Monatssoll" hint="Ist minus Soll im laufenden Monat">
        {isMonthLoading ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <span
            className={cn(
              "text-3xl font-semibold tabular-nums",
              monthDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {monthDelta > 0 ? "+" : ""}
            {monthDelta.toFixed(2)}
            <span className="ml-1 text-base font-normal text-muted-foreground">h</span>
          </span>
        )}
      </StatCard>
    </section>
  )
}
