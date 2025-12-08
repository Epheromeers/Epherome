export default function RadioButton(props: {
  children: React.ReactNode;
  checked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="flex items-center space-x-1 text-sm font-medium"
      type="button"
      onClick={props.onClick}
    >
      <div
        className={`rounded-full border border-blue-400 p-1 ${props.checked && "bg-blue-400"}`}
      />
      <div>{props.children}</div>
    </button>
  );
}
