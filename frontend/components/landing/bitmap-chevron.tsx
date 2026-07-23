export function BitmapChevron({ className }: { className?: string }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 11 11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="11" height="11" style={{ fill: "var(--accent)" }} />
      <path
        d="M3 3h5v1H3V3z M3 4h1v1H3V4z M7 4h1v1H7V4z M2 5h1v1H2V5z M8 6h1v1H8V6z M5 6h1v3H5V6z M4 7h3v1H4V7z"
        fill="#0a0a0a"
      />
    </svg>
  )
}
