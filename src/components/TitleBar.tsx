import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize, Minus, X } from "lucide-react";
import { Fragment } from "react";
import WindowControlIcon from "./WindowControlIcon";

export default function TitleBar(props: { isMac: boolean }) {
  const window = getCurrentWindow();

  return (
    <div
      className={`min-h-9 max-h-9 ${props.isMac ? "pl-24" : "pl-3"} flex items-center border-b border-gray-300 bg-linear-to-r from-sky-600 to-pink-300 text-white dark:border-gray-700`}
      data-tauri-drag-region
    >
      <div className="text-sm font-medium">Epherome</div>
      <div className="grow" />
      {!props.isMac && (
        <Fragment>
          <WindowControlIcon onClick={() => window.minimize()}>
            <Minus size={16} />
          </WindowControlIcon>
          <WindowControlIcon onClick={() => window.toggleMaximize()}>
            <Maximize size={16} />
          </WindowControlIcon>
          <WindowControlIcon onClick={() => window.close()}>
            <X size={16} />
          </WindowControlIcon>
        </Fragment>
      )}
    </div>
  );
}
