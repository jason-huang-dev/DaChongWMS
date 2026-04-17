export interface BulkActionFailure<TItem extends string | number> {
  item: TItem;
  message: string;
}

export interface BulkActionResult<TResult, TItem extends string | number> {
  successCount: number;
  successes: Array<{ item: TItem; result: TResult }>;
  failures: Array<BulkActionFailure<TItem>>;
}

export async function executeBulkAction<TResult, TItem extends string | number>(
  items: TItem[],
  action: (item: TItem) => Promise<TResult>,
): Promise<BulkActionResult<TResult, TItem>> {
  const results = await Promise.allSettled(items.map((item) => action(item)));

  const successes: Array<{ item: TItem; result: TResult }> = [];
  const failures: Array<BulkActionFailure<TItem>> = [];

  results.forEach((result, index) => {
    const item = items[index];

    if (result.status === "fulfilled") {
      successes.push({ item, result: result.value });
      return;
    }

    failures.push({
      item,
      message: result.reason instanceof Error ? result.reason.message : "Unknown error",
    });
  });

  return {
    successCount: successes.length,
    successes,
    failures,
  };
}
