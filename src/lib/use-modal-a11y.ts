"use client"

import { useEffect, useRef } from "react"

// Shared dialog behaviour for the cart drawer and the auth popup.
//
// Both rendered as plain divs: no dialog role, no focus management, and no
// Escape handling, so a keyboard or screen-reader user could tab straight out
// of an "open" modal into the page behind it. This adds the three things a
// modal actually needs, without pulling in a dialog library:
//
//   1. Escape closes it.
//   2. Focus moves into the dialog on open and is trapped inside while open,
//      then returns to whatever was focused before.
//   3. The page behind stops scrolling.
//
// Returns a ref to put on the dialog container.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Kept in a ref so the keydown listener always calls the latest handler
  // without re-running (and re-trapping focus) on every parent render. Synced
  // in an effect rather than during render, which the lint rules disallow.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusable = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .filter((el) => el.offsetParent !== null || el === document.activeElement)

    // Move focus in. Prefer the first field/button; fall back to the container.
    const first = focusable()[0]
    if (first) {
      first.focus()
    } else if (container) {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusable()
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      // Wrap at both ends so Tab cannot escape the dialog.
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    // Lock the page behind. This used to set overflow on <body> alone, which
    // did nothing here: the scrolling element on this site is <html>
    // (document.scrollingElement === documentElement), so the page kept
    // scrolling underneath an open cart. Both elements are locked now.
    //
    // Hiding the scrollbar widens the viewport by its width and shifts the whole
    // layout sideways, so the difference is added back as padding.
    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    }
    const scrollbarWidth = window.innerWidth - html.clientWidth

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${current + scrollbarWidth}px`
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      body.style.paddingRight = previous.bodyPaddingRight
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  return containerRef
}
