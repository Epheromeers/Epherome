import { Fragment, useContext } from "react";
import { AppContext, type DialogOptions } from "../store";
import Button from "./Button";

export default function Dialog(props: DialogOptions) {
  const app = useContext(AppContext);

  return (
    <div className="z-20 flex flex-col min-w-1/5 min-h-1/5 rounded-xl p-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-700">
      <div className="text-lg font-medium">{props.title}</div>
      {props.dangerMessage && (
        <div className="text-sm text-red-400">{props.dangerMessage}</div>
      )}
      <div className="text-sm pb-4">{props.message}</div>
      <div className="grow" />
      <div className="flex justify-end space-x-2">
        {props.action ? (
          <Fragment>
            <Button onClick={() => app.closeDialog()}>Cancel</Button>
            <Button
              danger={props.danger}
              onClick={() => {
                props.action?.();
                app.closeDialog();
              }}
            >
              {props.actionMessage ?? "Confirm"}
            </Button>
          </Fragment>
        ) : (
          <Button onClick={() => app.closeDialog()}>OK</Button>
        )}
      </div>
    </div>
  );
}
