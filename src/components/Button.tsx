import { useState } from "react";
import Tooltip from "./Tooltip";

export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
  className?: string;
  title?: string;
}) {
  const [tooltipActive, setTooltipActive] = useState(false);

  return (
    <button
      aria-label={props.title}
      className={`relative flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-white ${props.danger ? "bg-red-400" : props.secondary ? "bg-gray-500" : "bg-blue-400"} ${props.disabled ? "cursor-not-allowed opacity-80" : props.danger ? "hover:bg-red-500 active:bg-red-600" : props.secondary ? "hover:bg-gray-600 active:bg-gray-700" : "hover:bg-blue-500 active:bg-blue-600"} ${props.className ?? ""}`}
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      onMouseEnter={() => setTooltipActive(true)}
      onMouseLeave={() => setTooltipActive(false)}
    >
      {props.title && <Tooltip active={tooltipActive}>{props.title}</Tooltip>}
      {props.children}
    </button>
  );
}
