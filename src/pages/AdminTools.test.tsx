import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminTools from "./AdminTools";
import type { Tool } from "../lib/types";

const sampleTool = {
  slug: "sample-tool",
  name: "Sample Tool",
  short_description: "A sample ChatSched tool",
  description: "A full sample description.",
  category: "get_customers",
  tool_type: "native",
  icon: "Wrench",
  image_url: null,
  badge: null,
  status: "active",
  featured: false,
  sort_order: 1,
  cta_label: "Open tool",
  cta_url: "/dashboard",
  requires_auth: true,
  pricing_model: "free",
  setup_price: null,
  monthly_price: null,
  annual_price: null,
  target_customer: null,
  provider_name: "ChatSched",
  published_at: new Date().toISOString(),
} as unknown as Tool;

function resolvedQuery<T>(data: T) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve({ data, error: null })),
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data, error: null })),
      })),
    })),
  };
}

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn(() => resolvedQuery([])),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

describe("AdminTools editor", () => {
  it("loads an existing tool into editable fields", async () => {
    const { supabase } = await import("../lib/supabase");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "tools") return resolvedQuery([sampleTool]) as never;
      return resolvedQuery([]) as never;
    });

    render(
      <MemoryRouter>
        <AdminTools />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Sample Tool")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const name = await screen.findByDisplayValue("Sample Tool");
    expect(name).not.toBeDisabled();

    fireEvent.change(name, { target: { value: "AJ Tool Test" } });
    expect(name).toHaveValue("AJ Tool Test");
  });
});
