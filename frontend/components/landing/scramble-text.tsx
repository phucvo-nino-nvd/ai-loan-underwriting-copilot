"use client"

import { useEffect, useState, useRef, useCallback } from "react"

interface ScrambleTextProps {
  text: string
  className?: string
  delayMs?: number
  duration?: number
}

interface ScrambleTextOnHoverProps {
  text: string
  className?: string
  duration?: number
  as?: "span" | "button" | "div"
  onClick?: () => void
}

const GLYPHS = "!@#$%^&*()_+-=<>?/\\[]{}Xx"

function runScrambleAnimation(
  text: string,
  duration: number,
  setDisplayText: (text: string) => void,
  onComplete?: () => void,
): { kill: () => void } {
  const finalChars = text.split("")
  const totalChars = finalChars.length
  let start: number | null = null
  let rafId: number

  function step(timestamp: number) {
    if (!start) start = timestamp
    const elapsed = (timestamp - start) / 1000
    const progress = Math.min(elapsed / duration, 1)
    const easeProgress = progress * (2 - progress)

    const numLocked = Math.floor(easeProgress * totalChars)
    const newDisplay = finalChars
      .map((char, i) => (i < numLocked ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join("")

    setDisplayText(newDisplay)

    if (progress < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      setDisplayText(text)
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(step)
  return { kill: () => cancelAnimationFrame(rafId) }
}

export function ScrambleText({ text, className, delayMs = 0, duration = 0.9 }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [hasAnimated, setHasAnimated] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<{ kill: () => void } | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (hasAnimated || !text) return
    const scrambledStart = text
      .split("")
      .map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
      .join("")
    setDisplayText(scrambledStart)

    timeoutRef.current = setTimeout(() => {
      animationRef.current = runScrambleAnimation(text, duration, setDisplayText, () => {
        setHasAnimated(true)
      })
    }, delayMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (animationRef.current) animationRef.current.kill()
    }
  }, [])

  useEffect(() => {
    if (hasAnimated && displayText !== text) setDisplayText(text)
  }, [text, hasAnimated, displayText])

  return (
    <span ref={containerRef} className={className}>
      {displayText || text}
    </span>
  )
}

export function ScrambleTextOnHover({
  text,
  className,
  duration = 0.4,
  as: Component = "span",
  onClick,
}: ScrambleTextOnHoverProps) {
  const [displayText, setDisplayText] = useState(text)
  const isAnimating = useRef(false)
  const tweenRef = useRef<{ kill: () => void } | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (isAnimating.current) return
    isAnimating.current = true
    if (tweenRef.current) tweenRef.current.kill()

    const scrambledStart = text
      .split("")
      .map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
      .join("")
    setDisplayText(scrambledStart)

    tweenRef.current = runScrambleAnimation(text, duration, setDisplayText, () => {
      isAnimating.current = false
    })
  }, [text, duration])

  useEffect(() => {
    if (!isAnimating.current) setDisplayText(text)
  }, [text])

  return (
    <Component className={className} onMouseEnter={handleMouseEnter} onClick={onClick}>
      {displayText}
    </Component>
  )
}

