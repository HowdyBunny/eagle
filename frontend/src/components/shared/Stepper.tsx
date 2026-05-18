/**
 * Stepper — horizontal multi-step progress indicator.
 *
 * Visual language matches the existing `bg-primary animate-pulse` dot used
 * in TopBar's EAGLE RA badge, so different flows look consistent.
 *
 * States per step:
 *   done    → solid filled primary circle with ✓, connector line solid
 *   active  → pulsing primary dot, connector dashed afterwards
 *   pending → outlined grey circle, connector dashed afterwards
 *
 * Active step optionally shows an elapsed-seconds counter next to its label,
 * giving users feedback that something is happening without committing to a
 * fake percentage.
 */

import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface StepDef {
  key: string
  label: string
}

interface StepperProps {
  steps: StepDef[]
  /** Index of the currently active step. Steps before it are 'done', steps after are 'pending'. */
  activeIndex: number
  /** If true, all steps render as 'done' regardless of activeIndex. */
  allDone?: boolean
  /** Optional sub-text shown below the row (e.g. "正在 AI 提取..."). */
  caption?: string
  /** If true, show elapsed seconds next to the caption. Resets whenever activeIndex changes. */
  showElapsed?: boolean
}

export default function Stepper({
  steps,
  activeIndex,
  allDone = false,
  caption,
  showElapsed = false,
}: StepperProps) {
  const [elapsed, setElapsed] = useState(0)

  // Reset and re-tick the elapsed counter whenever the active step changes.
  useEffect(() => {
    if (!showElapsed || allDone) {
      setElapsed(0)
      return
    }
    setElapsed(0)
    const t0 = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [activeIndex, showElapsed, allDone])

  return (
    <div className="w-full">
      <div className="flex items-center">
        {steps.map((step, i) => {
          const isDone = allDone || i < activeIndex
          const isActive = !allDone && i === activeIndex
          const isLast = i === steps.length - 1

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                    isDone && 'bg-primary text-white',
                    isActive && 'bg-primary text-white',
                    !isDone && !isActive && 'bg-surface-container border-2 border-outline-variant/40',
                  )}
                >
                  {isDone ? (
                    <Check size={13} strokeWidth={3} />
                  ) : isActive ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium tracking-wide whitespace-nowrap',
                    isDone && 'text-on-surface',
                    isActive && 'text-primary font-bold',
                    !isDone && !isActive && 'text-secondary/60',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 mb-5 transition-colors',
                    isDone ? 'bg-primary' : 'bg-outline-variant/30',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {caption && (
        <p className="text-center text-sm text-secondary mt-4">
          {caption}
          {showElapsed && !allDone && elapsed > 0 && (
            <span className="ml-2 text-xs text-secondary/60">{elapsed}s</span>
          )}
        </p>
      )}
    </div>
  )
}
