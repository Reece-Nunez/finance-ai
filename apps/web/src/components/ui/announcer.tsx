'use client'

import { useEffect, useState } from 'react'

interface AnnouncerProps {
  message: string
  politeness?: 'polite' | 'assertive'
}

/**
 * Screen reader announcer component for dynamic content updates.
 * Uses aria-live regions to announce changes to assistive technologies.
 *
 * @example
 * <Announcer message={`${count} items loaded`} />
 * <Announcer message="Error saving" politeness="assertive" />
 */
export function Announcer({ message, politeness = 'polite' }: AnnouncerProps) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    // Clear and re-set to trigger announcement even for same message
    setAnnouncement('')
    const timer = setTimeout(() => setAnnouncement(message), 100)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}
