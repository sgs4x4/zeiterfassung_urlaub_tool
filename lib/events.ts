// Simple event system for cross-component communication
type EventCallback = () => void

class TimeEntryEvents {
  private listeners: Set<EventCallback> = new Set()

  subscribe(callback: EventCallback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  emit() {
    this.listeners.forEach(callback => callback())
  }
}

export const timeEntryEvents = new TimeEntryEvents()
