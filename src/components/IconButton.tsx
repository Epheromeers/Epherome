import { useState } from "react";
import Tooltip, { type TooltipPlacement } from "./Tooltip";

export default function IconButton(props: {
  children: React.ReactNode;
  active?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  small?: boolean;
  title?: string;
  toast?: boolean;
  tooltipPlacement?: TooltipPlacement;
}) {
  const [tooltipActive, setTooltipActive] = useState(false);

  return (
    <button
      aria-label={props.ariaLabel ?? props.title}
      className={`relative flex items-center rounded ${props.small ? "p-1 text-gray-700 dark:text-gray-400" : "p-2"} ${props.toast ? "hover:bg-white/10 active:bg-white/20" : props.active ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"}`}
      type="button"
      onClick={props.onClick}
      onMouseEnter={() => setTooltipActive(true)}
      onMouseLeave={() => setTooltipActive(false)}
    >
      {props.title && (
        <Tooltip active={tooltipActive} placement={props.tooltipPlacement}>
          {props.title}
        </Tooltip>
      )}
      {props.children}
    </button>
  );
}
