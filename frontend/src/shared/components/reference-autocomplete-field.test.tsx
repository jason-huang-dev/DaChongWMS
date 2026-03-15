import { fireEvent, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { useState } from "react";
import { expect, test, vi } from "vitest";

import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { renderWithProviders } from "@/test/render";

const setSearchTerm = vi.fn();
const loadMore = vi.fn();

function TestForm() {
  const form = useForm<{ warehouse: number | null }>({
    defaultValues: { warehouse: null },
  });
  const [searchTerm, setLocalSearchTerm] = useState("");

  return (
    <FormProvider {...form}>
      <ReferenceAutocompleteField
        label="Warehouse"
        name="warehouse"
        reference={{
          options: [
            {
              value: 1,
              label: "Warehouse A",
              description: "New York",
              record: { id: 1, warehouse_name: "Warehouse A" },
            },
          ],
          query: {
            data: undefined,
            error: null,
            fetchNextPage: vi.fn(),
            hasNextPage: true,
            isFetchingNextPage: false,
            isLoading: false,
          } as never,
          searchTerm,
          setSearchTerm: (value) => {
            setSearchTerm(value);
            setLocalSearchTerm(value);
          },
          loadMore,
          hasMore: true,
        }}
      />
    </FormProvider>
  );
}

test("supports searchable and paginated reference selectors", async () => {
  setSearchTerm.mockClear();
  loadMore.mockClear();
  renderWithProviders(<TestForm />);

  const input = screen.getByRole("combobox", { name: "Warehouse" });
  fireEvent.mouseDown(input);
  fireEvent.change(input, { target: { value: "Ware" } });

  expect(screen.getByText("Warehouse A")).toBeInTheDocument();

  const listbox = await screen.findByRole("listbox");
  Object.defineProperty(listbox, "scrollHeight", { configurable: true, value: 120 });
  Object.defineProperty(listbox, "clientHeight", { configurable: true, value: 40 });
  Object.defineProperty(listbox, "scrollTop", { configurable: true, value: 90 });
  fireEvent.scroll(listbox);

  expect(input).toHaveValue("Ware");
  expect(setSearchTerm).toHaveBeenCalledWith("Ware");
  expect(loadMore).toHaveBeenCalledTimes(1);
});
