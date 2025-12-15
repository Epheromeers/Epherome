export default function Checkbox(props: {
  children: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center space-x-1"
      onClick={() => props.onChange(!props.checked)}
    >
      <div
        className={`rounded p-2 border border-gray-300 ${props.checked ? "bg-blue-500" : "bg-white"}`}
      ></div>
      <div>{props.children}</div>
    </button>
  );
}
