import { Check, X } from "lucide-react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../store";
import type { ToastOptions } from "../store/status";
import IconButton from "./IconButton";

const transitionDuration = 300;
const displayDuration = 3000;

export default function Toast(props: ToastOptions) {
  const app = useContext(AppContext);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const dismissing = useRef(false);
  const success = props.category === "success";

  const dismissToast = useCallback(() => {
    if (dismissing.current) {
      return;
    }

    dismissing.current = true;
    setVisible(false);
    closeTimer.current = window.setTimeout(
      () => app.closeToast(),
      transitionDuration,
    );
  }, [app.closeToast]);

  useEffect(() => {
    const enterFrame = window.requestAnimationFrame(() => setVisible(true));
    const exitTimer = window.setTimeout(dismissToast, displayDuration);

    return () => {
      window.cancelAnimationFrame(enterFrame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(closeTimer.current);
    };
  }, [dismissToast]);

  const Icon = success ? Check : X;

  return (
    <div
      className={`fixed right-4 bottom-4 z-30 flex max-w-sm items-center gap-2 rounded-lg px-4 py-2.5 text-white shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none ${
        success ? "bg-green-600" : "bg-red-500"
      } ${visible ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}`}
    >
      <div
        aria-atomic="true"
        aria-live={success ? "polite" : "assertive"}
        className="flex min-w-0 grow items-center gap-3"
        role={success ? "status" : "alert"}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white">
          <Icon
            aria-hidden="true"
            className={success ? "text-green-600" : "text-red-500"}
            size={18}
            strokeWidth={3}
          />
        </div>
        <div className="text-sm font-medium">{props.content}</div>
      </div>
      <IconButton ariaLabel="Close toast" onClick={dismissToast} small toast>
        <X aria-hidden="true" className="text-white" size={18} />
      </IconButton>
    </div>
  );
}
