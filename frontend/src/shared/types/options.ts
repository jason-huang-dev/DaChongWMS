export interface ReferenceOption<TValue extends string | number = number, TRecord = unknown> {
  value: TValue;
  label: string;
  description?: string;
  record: TRecord;
}
