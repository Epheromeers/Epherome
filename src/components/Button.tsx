export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`rounded-full text-sm font-medium px-3 py-1 bg-blue-400 text-white ${props.disabled ? "opacity-80 cursor-not-allowed" : "hover:bg-blue-500 active:bg-blue-600"}`}
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}
