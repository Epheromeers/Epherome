export default function Spin(props: { blackRing?: boolean }) {
  return (
    <svg
      aria-label="Loading"
      className={`mr-3 size-5 animate-spin ${props.blackRing ? "text-black" : "text-blue-500"}`}
      fill="none"
      role="status"
      viewBox="0 0 50 50"
    >
      <circle
        className="opacity-20"
        cx="25"
        cy="25"
        r="20"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M25 5a20 20 0 0 1 20 20h-6a14 14 0 0 0-14-14z"
      />
    </svg>
  );
}
