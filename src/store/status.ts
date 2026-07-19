export interface ProcessOutput {
  nanoid: string;
  stream: string;
  line: string;
}

const processOutputs: { [key: string]: ProcessOutput[] } = {};
const errorList: string[] = [];

export function emitProcessOutput(processOutput: ProcessOutput) {
  if (!processOutputs[processOutput.nanoid]) {
    processOutputs[processOutput.nanoid] = [];
  }
  processOutputs[processOutput.nanoid].push(processOutput);
}

export function emitError(error: string) {
  errorList.push(error);
}

export function getProcessOutput(nanoid: string) {
  return processOutputs[nanoid] || [];
}

export function getProcesses() {
  return Object.keys(processOutputs);
}

export function getErrors() {
  return errorList.map((err) => ({ stream: "stderr", line: err }));
}

export interface DialogOptions {
  title: string;
  message: string;
  dangerMessage?: string;
  action?: () => void;
  danger?: boolean;
  actionMessage?: string;
}

export type ToastCategory = "success" | "fail";

export interface ToastOptions {
  category: ToastCategory;
  content: string;
}

export interface AppStatus {
  launchMessage?: string;
}
