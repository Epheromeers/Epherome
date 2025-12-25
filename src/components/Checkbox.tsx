export default function Checkbox(props: {
  children: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-1">
      <input
        type="checkbox"
        className="w-5 h-5"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <div>{props.children}</div>
    </div>
  );
}
