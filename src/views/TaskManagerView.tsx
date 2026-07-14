import { useEffect, useRef, useState } from "react";
import ListItem from "../components/ListItem";
import { getErrors, getProcesses, getProcessOutput } from "../store/status";

export default function TaskManagerView() {
  const [current, setCurrent] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<{ stream: string; line: string }[]>(
    [],
  );
  const processes = getProcesses();
  const errorList = getErrors();
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  });

  const switchProcess = (nanoid: string) => {
    setCurrent(nanoid);
    setOutputs(getProcessOutput(nanoid));
  };

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1 overflow-auto">
        <ListItem checked={current === null} onClick={() => setCurrent(null)}>
          Epherome
        </ListItem>
        {processes.map((nanoid, index) => (
          <ListItem
            key={nanoid}
            checked={current === nanoid}
            onClick={() => switchProcess(nanoid)}
          >
            Minecraft ({index + 1})
          </ListItem>
        ))}
      </div>
      <div ref={outputRef} className="w-4/5 p-2 overflow-auto">
        {(current === null ? errorList : outputs).map((output, index) => (
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
