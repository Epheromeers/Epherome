export default function Input(props: {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <input
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      className="border border-gray-300 rounded-full text-sm px-3 py-1 focus:outline-none"
    />
  );
}
