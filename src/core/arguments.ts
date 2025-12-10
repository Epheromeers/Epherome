import { type ClientJsonRule, isAllCompliant } from "./rules";

interface ClientJsonConditionalValue {
  rules: ClientJsonRule[];
  value: string | string[];
}

export interface ClientJsonArguments {
  game: (string | ClientJsonConditionalValue)[];
  jvm: (string | ClientJsonConditionalValue)[];
}

function replaceParams(str: string, params: { [key: string]: string }): string {
  let result = str;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function parseClientJsonArguments(
  jsonArguments: ClientJsonArguments,
  params: { [key: string]: string } = {},
) {
  const gameArgs: string[] = [];
  const jvmArgs: string[] = [];

  for (const arg of jsonArguments.game) {
    if (typeof arg === "string") {
      gameArgs.push(replaceParams(arg, params));
    } else if (isAllCompliant(arg.rules)) {
      if (Array.isArray(arg.value)) {
        gameArgs.push(...arg.value.map((v) => replaceParams(v, params)));
      } else gameArgs.push(replaceParams(arg.value, params));
    }
  }

  for (const arg of jsonArguments.jvm) {
    if (typeof arg === "string") {
      jvmArgs.push(replaceParams(arg, params));
    } else if (isAllCompliant(arg.rules)) {
      if (Array.isArray(arg.value)) {
        jvmArgs.push(...arg.value.map((v) => replaceParams(v, params)));
      } else jvmArgs.push(replaceParams(arg.value, params));
    }
  }

  return { gameArgs, jvmArgs };
}
