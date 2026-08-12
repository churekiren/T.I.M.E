// Audio is intentionally not implemented yet. Future sound playback should
// subscribe to this presentation-start event, never directly to Realtime.
export function announceArrivalPresentation(entry) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('time:wall-arrival-start', {
    detail: {
      enrollmentId: entry.enrollmentId,
      codename: entry.codename,
      returningAgent: entry.returningAgent,
    },
  }))
}
