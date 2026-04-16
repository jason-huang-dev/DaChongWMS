import { useMemo } from "react";

import { useSearchParams } from "react-router-dom";

export function useInboundWorkspaceTab<TValue extends string>(
  allowedValues: readonly TValue[],
  defaultValue: TValue,
  key = "tab",
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const rawValue = searchParams.get(key);
    return rawValue && allowedValues.includes(rawValue as TValue) ? (rawValue as TValue) : defaultValue;
  }, [allowedValues, defaultValue, key, searchParams]);

  function setValue(nextValue: TValue) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextValue === defaultValue) {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, nextValue);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  return { setValue, value };
}
