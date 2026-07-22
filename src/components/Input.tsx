export default function Input(props: {
  id?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  password?: boolean;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  spellCheck?: boolean;
  className?: string;
}) {
  return (
    <input
      id={props.id}
      placeholder={props.placeholder}
      value={props.value}
      defaultValue={props.defaultValue}
      type={props.password ? "password" : "text"}
      onChange={(e) => props.onChange?.(e.target.value)}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      spellCheck={props.spellCheck}
      className={`rounded-full border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 ${props.className ?? ""}`}
    />
  );
}
