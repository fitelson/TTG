export const assert = (condition: boolean, message: string = ''): void => {
  if (!condition) throw new Error(message)
}

export const assert_exists = <T>(t?: T | null, msg?: string): T => {
  if (t === undefined || t === null) throw new Error(msg ?? 'doesn\'t exist!')
  return t
}

export type Res<S, F> = [true, S] | [false, F]

export const assert_result = <T>(r: Res<T, string>): T => {
  const [status, t] = r
  if (!status) {
    throw new Error(t)
  } else {
    return t
  }
}
