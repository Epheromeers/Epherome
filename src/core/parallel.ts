import { downloadFile } from "./download";

export interface OmittedParallelTask {
  url: string;
  name: string;
  destination: string;
}

export type ParallelTask = OmittedParallelTask & {
  id: number;
  completed: boolean;
  failed?: boolean;
};

let cursor = 0;

function shortid(): number {
  return cursor++;
}

export class ParallelManager {
  tasks: ParallelTask[] = [];
  maxConcurrent: number = 10;
  current: ParallelTask[] = [];
  onChange: (tasks: ParallelTask[]) => void;
  finished: number = 0;
  onFinish?: () => void;

  constructor(
    tasks: OmittedParallelTask[],
    onChange: (tasks: ParallelTask[]) => void,
  ) {
    this.tasks = tasks.map((task) => ({
      id: shortid(),
      completed: false,
      ...task,
    }));
    this.onChange = onChange;
  }

  start() {
    for (const item of this.tasks) {
      if (this.current.length >= this.maxConcurrent) break;
      if (item.completed) continue;
      if (item.failed) continue;
      if (this.current.some((t) => t.id === item.id)) continue;

      downloadFile(item.url, item.destination)
        .then(() => {
          item.completed = true;
          this.finished++;
          this.current = this.current.filter((t) => t.id !== item.id);
          this.onChange(this.current);
          this.start();

          if (this.finished === this.tasks.length && this.onFinish) {
            this.onFinish();
          }
        })
        .catch(() => {
          console.error(`Failed to download ${item.name}`);

          item.failed = true;
          this.finished++;
          this.current = this.current.filter((t) => t.id !== item.id);
          this.onChange(this.current);
          this.start();

          if (this.finished === this.tasks.length && this.onFinish) {
            this.onFinish();
          }
        });
      this.current.push(item);
      this.onChange(this.current);
    }
  }
}
