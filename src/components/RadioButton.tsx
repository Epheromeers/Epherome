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
        className={`rounded-full border border-sky-500 w-4 h-4 flex items-center justify-center`}
      >
        {props.checked && <div className="rounded-full w-3 h-3 bg-sky-500" />}
      </div>
      <div>{props.children}</div>
    </button>
  );
}
