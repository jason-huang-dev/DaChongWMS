export interface FbMessage<T> {
  code: string;
  msg: string;
  data: T;
  ip?: string;
  results?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SelectOption {
  label: string;
  value: string;
}
