import { useState } from "react";
import ListItem from "../components/ListItem";
import { errorList, processOutputTable } from "../store";

export default function TaskManagerView() {
  const table = Object.entries(processOutputTable);
  const [current, setCurrent] = useState<string | null>(null);
  const outputs =
    current === null
      ? null
      : table.find(([nanoid, _]) => nanoid === current)?.[1];

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1 overflow-auto">
        <ListItem checked={current === null} onClick={() => setCurrent(null)}>
          Epherome
        </ListItem>
        {table.map(([nanoid, _], index) => (
          <ListItem
            key={nanoid}
            checked={current === nanoid}
            onClick={() => setCurrent(nanoid)}
          >
            Minecraft ({index + 1})
          </ListItem>
        ))}
      </div>
      <div className="w-4/5 p-2 overflow-auto">
        {outputs === null
          ? errorList.map((error, index) => (
              <div className="text-sm font-mono" key={index.toString()}>
                {error}
              </div>
            ))
          : (outputs ?? []).map((output, index) => (
              <div
                key={index.toString()}
                className={`text-sm font-mono ${output.stream === "stderr" && "text-red-500"}`}
              >
                {output.line}
              </div>
            ))}
      </div>
    </div>
  );
}
