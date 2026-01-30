export function applyIgnore<T>(list: T[], ignore: T[]): T[] {
  return list.filter((item) => !ignore.includes(item));
}
