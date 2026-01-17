export default function Input(props: {
  placeholder?: string;
  value?: string;
  password?: boolean;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}) {
  return (
    <input
      placeholder={props.placeholder}
      value={props.value}
      type={props.password ? "password" : "text"}
      onChange={(e) => props.onChange?.(e.target.value)}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      className={`border border-gray-300 dark:border-gray-700 rounded-full text-sm px-3 py-1 focus:outline-none focus:ring-2 ring-blue-500 ${props.className}`}
    />
  );
}
