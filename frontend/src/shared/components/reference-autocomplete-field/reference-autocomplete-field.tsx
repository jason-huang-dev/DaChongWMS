import type { TextFieldProps } from "@mui/material";

import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";

interface ReferenceAutocompleteFieldProps<TValue extends string | number, TRecord>
  extends Omit<TextFieldProps, "name" | "value" | "defaultValue" | "onChange"> {
  name: string;
  reference: ReferenceListState<TValue, TRecord>;
  emptyText?: string;
}

export function ReferenceAutocompleteField<TValue extends string | number, TRecord>({
  name,
  reference,
  emptyText,
  ...props
}: ReferenceAutocompleteFieldProps<TValue, TRecord>) {
  return (
    <FormAutocomplete
      {...props}
      emptyText={emptyText}
      hasMore={reference.hasMore}
      isLoadingMore={reference.query.isFetchingNextPage}
      loading={reference.query.isLoading}
      name={name}
      onReachEnd={reference.loadMore}
      onSearchTextChange={reference.setSearchTerm}
      options={reference.options}
      searchText={reference.searchTerm}
    />
  );
}
