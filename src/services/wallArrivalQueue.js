function enrollmentId(entry) {
  return entry?.enrollmentId || null
}

export function createWallArrivalQueue({ onActiveChange = () => {}, onPresentationStart = () => {} } = {}) {
  let initialized = false
  let active = null
  let queue = []
  const knownIds = new Set()
  const queuedIds = new Set()

  const promote = () => {
    if (active || queue.length === 0) return
    active = queue.shift()
    queuedIds.delete(enrollmentId(active))
    onActiveChange(active)
    onPresentationStart(active)
  }

  return {
    initialize(entries = []) {
      knownIds.clear()
      entries.forEach((entry) => {
        const id = enrollmentId(entry)
        if (id) knownIds.add(id)
      })
      initialized = true
    },

    reconcile(entries = [], { announce = true } = {}) {
      if (!initialized) {
        this.initialize(entries)
        return []
      }

      const added = []
      entries.forEach((entry) => {
        const id = enrollmentId(entry)
        if (!id || knownIds.has(id)) return

        knownIds.add(id)
        if (!announce || queuedIds.has(id) || enrollmentId(active) === id) return
        queuedIds.add(id)
        queue.push(entry)
        added.push(entry)
      })
      promote()
      return added
    },

    complete(id) {
      if (!active || enrollmentId(active) !== id) return false
      active = null
      onActiveChange(null)
      promote()
      return true
    },

    reset() {
      initialized = false
      active = null
      queue = []
      knownIds.clear()
      queuedIds.clear()
      onActiveChange(null)
    },

    isInitialized() {
      return initialized
    },

    snapshot() {
      return {
        initialized,
        active,
        queued: [...queue],
        knownIds: new Set(knownIds),
        queuedIds: new Set(queuedIds),
      }
    },
  }
}
