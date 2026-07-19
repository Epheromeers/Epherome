import { useState } from "react";
import Tooltip from "./Tooltip";

export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
  title?: string;
}) {
  const [tooltipActive, setTooltipActive] = useState(false);

  return (
    <button
      aria-label={props.title}
      className={`relative flex items-center gap-1 rounded-full text-sm font-medium px-3 py-1 ${props.danger ? "bg-red-400" : "bg-blue-400"} text-white ${props.disabled ? "opacity-80 cursor-not-allowed" : props.danger ? "hover:bg-red-500 active:bg-red-600" : "hover:bg-blue-500 active:bg-blue-600"} ${props.className ?? ""}`}
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
