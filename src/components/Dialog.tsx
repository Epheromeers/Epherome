import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppContext } from "../store";
import type { DialogOptions } from "../store/status";
import Button from "./Button";

const transitionDuration = 200;

export default function Dialog(props: DialogOptions) {
  const app = useContext(AppContext);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const dismissing = useRef(false);

  const dismissDialog = useCallback(
    (action?: () => void) => {
      if (dismissing.current) {
        return;
      }

      dismissing.current = true;
      setVisible(false);
      closeTimer.current = window.setTimeout(
        () => app.closeDialog(),
        transitionDuration,
      );
      action?.();
    },
    [app.closeDialog],
  );

  useEffect(() => {
    const enterFrame = window.requestAnimationFrame(() => setVisible(true));

    return () => {
      window.cancelAnimationFrame(enterFrame);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      className={`absolute top-1/2 left-1/2 z-20 flex min-h-1/5 min-w-1/5 -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white p-4 transition-[transform,scale,opacity] duration-200 ease-out motion-reduce:transition-none dark:bg-gray-700 ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
    >
      <div className="text-lg font-medium">{props.title}</div>
      {props.dangerMessage && (
        <div className="text-sm text-red-400">{props.dangerMessage}</div>
      )}
      <div className="text-sm pb-4">{props.message}</div>
      <div className="grow" />
      <div className="flex justify-end space-x-2">
        {props.action ? (
          <Fragment>
            <Button onClick={() => dismissDialog()}>Cancel</Button>
            <Button
              danger={props.danger}
              onClick={() => dismissDialog(props.action)}
            >
              {props.actionMessage ?? "Confirm"}
            </Button>
          </Fragment>
        ) : (
          <Button onClick={() => dismissDialog()}>OK</Button>
        )}
      </div>
    </div>
  );
}
