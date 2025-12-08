export default function Input(props: {
  placeholder?: string;
  value?: string;
  password?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <input
      placeholder={props.placeholder}
      value={props.value}
      type={props.password ? "password" : "text"}
      onChange={(e) => props.onChange?.(e.target.value)}
      className="border border-gray-300 rounded-full text-sm px-3 py-1 focus:outline-none"
    />
  );
}
