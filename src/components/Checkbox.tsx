import { Check } from "lucide-react";

export default function Checkbox(props: {
  children: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex space-x-1 items-center"
      type="button"
      onClick={() => props.onChange(!props.checked)}
    >
      <div className="border border-gray-300 dark:border-gray-700 rounded w-4 h-4 flex items-center justify-center">
        {props.checked && <Check strokeWidth={3} size={12} />}
      </div>
      <div className="text-sm font-medium">{props.children}</div>
    </button>
  );
}
