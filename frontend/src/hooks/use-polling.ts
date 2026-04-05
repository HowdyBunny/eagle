import { useEffect, useRef } from 'react'

export function usePolling(
  fn: () => Promise<boolean>,
  intervalMs: number,
  enabled: boolean
) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let stopped = false

    const tick = async () => {
      if (stopped) return
      const done = await fnRef.current()
      if (!done && !stopped) {
        setTimeout(tick, intervalMs)
      }
    }

    tick()
    return () => { stopped = true }
  }, [enabled, intervalMs])
}
