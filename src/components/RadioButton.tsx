export default function RadioButton(props: {
  children: React.ReactNode;
  checked?: boolean;
  name?: string;
  onClick?: () => void;
  value?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center space-x-1 text-sm font-medium">
      <input
        checked={props.checked ?? false}
        className="sr-only"
        name={props.name}
        onChange={props.onClick}
        type="radio"
        value={props.value}
      />
      <div
        aria-hidden="true"
        className={`rounded-full border border-sky-500 w-4 h-4 flex items-center justify-center`}
      >
        {props.checked && <div className="rounded-full w-3 h-3 bg-sky-500" />}
      </div>
      <div>{props.children}</div>
    </label>
  );
}
