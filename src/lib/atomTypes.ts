import { atom } from "jotai";

// 我们不需要自定义PrimitiveAtom类型，直接使用jotai提供的类型
// 移除错误的类型定义，改为导出工厂函数

// 创建一个简单状态的atom
export function createAtom<T>(initialValue: T) {
  return atom(initialValue);
}

// 创建派生的atom
export function createDerivedAtom<T, U>(
  baseAtom: ReturnType<typeof atom<T>>,
  read: (value: T) => U
) {
  return atom((get) => read(get(baseAtom)));
}

// 创建一个写入派生atom的函数
export function createWritableAtom<T, Args extends any[], Result>(
  readAtom: ReturnType<typeof atom<T>>,
  write: (
    get: (atom: any) => any,
    set: (atom: any, value: any) => void,
    ...args: Args
  ) => Result
) {
  return atom((get) => get(readAtom), write);
}
