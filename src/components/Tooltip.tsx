import { useEffect, useState } from "react";

export type TooltipPlacement = "bottom-left" | "bottom-right" | "right";

const displayDelay = 500;
const transitionDuration = 150;

function getPlacementClasses(placement: TooltipPlacement) {
  if (placement === "right") {
    return "top-1/2 left-full ml-1 -translate-y-1/2 origin-left";
  }

  if (placement === "bottom-left") {
    return "top-full right-full mt-1 mr-1 origin-top-right";
  }

  return "top-full left-full mt-1 ml-1 origin-top-left";
}

export default function Tooltip(props: {
  active: boolean;
  children: string;
  placement?: TooltipPlacement;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame: number | undefined;
    let timer: number | undefined;

    if (props.active) {
      if (mounted) {
        frame = window.requestAnimationFrame(() => setVisible(true));
      } else {
        timer = window.setTimeout(() => setMounted(true), displayDelay);
      }
    } else if (mounted) {
      setVisible(false);
      timer = window.setTimeout(() => setMounted(false), transitionDuration);
    }

    return () => {
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame);
      }
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [mounted, props.active]);

  if (!mounted) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-50 whitespace-nowrap rounded bg-black/70 px-2 py-1 text-xs font-medium text-white transition-[transform,translate,scale,opacity] duration-150 ease-out motion-reduce:transition-none ${getPlacementClasses(props.placement ?? "bottom-right")} ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
    >
      {props.children}
    </span>
  );
}
