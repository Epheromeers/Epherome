import { downloadFile } from "./download";

export type RunTaskResult<R> =
  | {
      ok: true;
      data: R;
      error: undefined;
    }
  | {
      ok: false;
      data: undefined;
      error: string;
    };

function normalizeConcurrency(limit: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  if (!Number.isFinite(limit)) {
    return 1;
  }
  const rounded = Math.floor(limit);
  if (rounded < 1) {
    return 1;
  }
  return Math.min(rounded, total);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return `${error}`;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<RunTaskResult<R>[]> {
  if (items.length === 0) {
    return [];
  }

  const safeLimit = normalizeConcurrency(limit, items.length);
  const resultBuffer: RunTaskResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor++;
      if (index >= items.length) {
        return;
      }
      try {
        const data = await worker(items[index], index);
        resultBuffer[index] = {
          ok: true,
          data,
          error: undefined,
        };
      } catch (error) {
        resultBuffer[index] = {
          ok: false,
          data: undefined,
          error: toErrorMessage(error),
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: safeLimit }, async () => {
      await runWorker();
    }),
  );

  return resultBuffer;
}

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
  private onFinish?: () => void;

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

  setOnFinish(callback: () => void) {
    this.onFinish = callback;
    this.checkFinish();
  }

  checkFinish() {
    if (this.finished === this.tasks.length && this.onFinish) {
      this.onFinish();
    }
  }

  start() {
    this.checkFinish();

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
          this.checkFinish();
        })
        .catch(() => {
          console.error(`Failed to download ${item.name}`);

          item.failed = true;
          this.finished++;
          this.current = this.current.filter((t) => t.id !== item.id);
          this.onChange(this.current);
          this.start();
          this.checkFinish();
        });
      this.current.push(item);
      this.onChange(this.current);
    }
  }
}
