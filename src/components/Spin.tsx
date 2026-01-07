export default function Spin() {
  return (
    <svg
      className="mr-3 size-5 animate-spin text-blue-500"
      viewBox="0 0 50 50"
      fill="none"
    >
      <title>Loading</title>
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
