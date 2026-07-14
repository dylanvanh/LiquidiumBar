import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { marketSnapshotFixture, portfolioFixture } from "../test/fixtures";
import { MarketsView } from "./MarketsView";
import { PortfolioView } from "./PortfolioView";
import type { ProfileRecord } from "./storage";

const queryMocks = vi.hoisted(() => ({
  fetchMarkets: vi.fn(),
  fetchPortfolio: vi.fn(),
}));

vi.mock("./queries", () => queryMocks);

function renderWithQuery(ui: React.ReactNode, client = createClient()) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
}

const basePortfolioProps = {
  panelOpen: true,
  refreshIntervalSeconds: 300,
  profiles: [{ id: "aaaaa-aa", label: "Main" }],
  selectedProfileId: "aaaaa-aa",
  hideBalances: false,
  onAddProfile: vi.fn(),
  onSelectProfile: vi.fn(),
  onRenameProfile: vi.fn(),
  onRemoveProfile: vi.fn(),
  onTogglePrivacy: vi.fn(),
};

describe("market states", () => {
  it("renders a loading state", () => {
    queryMocks.fetchMarkets.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<MarketsView panelOpen refreshIntervalSeconds={300} />);
    expect(screen.getByLabelText("Loading markets")).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("renders partial pricing disclosure", async () => {
    queryMocks.fetchMarkets.mockResolvedValue(
      marketSnapshotFixture({ pricesComplete: false })
    );
    renderWithQuery(<MarketsView panelOpen refreshIntervalSeconds={300} />);
    expect((await screen.findAllByText("BTC"))[0]).toBeVisible();
    expect(screen.getByText(/Totals exclude pools/)).toBeVisible();
  });

  it("retains cached data when a refresh fails", async () => {
    const client = createClient();
    client.setQueryData(["markets"], marketSnapshotFixture());
    queryMocks.fetchMarkets.mockRejectedValue(new Error("offline"));
    renderWithQuery(<MarketsView panelOpen refreshIntervalSeconds={300} />, client);
    expect(await screen.findByText(/Refresh failed\. Showing data/)).toBeVisible();
    expect(screen.getAllByText("BTC")[0]).toBeVisible();
  });
});

describe("portfolio states", () => {
  it("rejects an invalid profile before querying", async () => {
    const user = userEvent.setup();
    const onAddProfile = vi.fn();
    renderWithQuery(
      <PortfolioView
        {...basePortfolioProps}
        profiles={[]}
        selectedProfileId={undefined}
        onAddProfile={onAddProfile}
      />
    );
    await user.type(screen.getByLabelText("Profile principal"), "not valid");
    await user.click(screen.getByRole("button", { name: "Add profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent("invalid");
    expect(onAddProfile).not.toHaveBeenCalled();
  });

  it("renders a valid empty portfolio", async () => {
    queryMocks.fetchPortfolio.mockResolvedValue(
      portfolioFixture({ positions: [], totalSuppliedUsd: undefined })
    );
    renderWithQuery(<PortfolioView {...basePortfolioProps} />);
    expect(await screen.findByText("No active positions")).toBeVisible();
  });

  it("switches profiles and changes the query key", async () => {
    queryMocks.fetchPortfolio.mockImplementation(async (profileId: string) =>
      portfolioFixture({ profileId, positions: [] })
    );
    const profiles: ProfileRecord[] = [
      { id: "aaaaa-aa", label: "One" },
      { id: "rrkah-fqaaa-aaaaa-aaaaq-cai", label: "Two" },
    ];

    function Harness() {
      const [selected, setSelected] = useState(profiles[0]?.id);
      return (
        <PortfolioView
          {...basePortfolioProps}
          profiles={profiles}
          selectedProfileId={selected}
          onSelectProfile={setSelected}
        />
      );
    }

    renderWithQuery(<Harness />);
    await screen.findByText("No active positions");
    fireEvent.change(screen.getByLabelText("Selected profile"), {
      target: { value: profiles[1]?.id },
    });
    await waitFor(() =>
      expect(queryMocks.fetchPortfolio).toHaveBeenCalledWith(profiles[1]?.id)
    );
  });

  it("hides balances while leaving unavailable SDK fields explicit", async () => {
    const user = userEvent.setup();
    queryMocks.fetchPortfolio.mockResolvedValue(portfolioFixture());
    renderWithQuery(<PortfolioView {...basePortfolioProps} hideBalances />);
    expect(await screen.findAllByText("••••••")).not.toHaveLength(0);
    const btcLabel = screen.getAllByText("BTC").at(0);
    expect(btcLabel).toBeDefined();
    if (btcLabel) await user.click(btcLabel);
    expect(screen.getByText("Collateral flag")).toBeVisible();
    expect(screen.getByText("Unavailable")).toBeVisible();
  });
});
