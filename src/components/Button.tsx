export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex items-center space-x-1 rounded-full text-sm font-medium px-3 py-1 ${props.danger ? "bg-red-400" : "bg-blue-400"} text-white ${props.disabled ? "opacity-80 cursor-not-allowed" : props.danger ? "hover:bg-red-500 active:bg-red-600" : "hover:bg-blue-500 active:bg-blue-600"}`}
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}
