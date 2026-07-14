import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { marketSnapshotFixture, portfolioFixture } from "../test/fixtures";
import { DisplayModeSwitcher } from "./DisplayModeSwitcher";
import { InsightsView } from "./InsightsView";
import { PortfolioView } from "./PortfolioView";
import { SettingsView } from "./SettingsView";
import type { ProfileRecord } from "./storage";

const queryMocks = vi.hoisted(() => ({
  fetchMarkets: vi.fn(),
  fetchPortfolio: vi.fn(),
}));

vi.mock("./queries", () => queryMocks);
vi.mock("./DitherCharts", () => ({
  MarketValueChart: () => (
    <section aria-label="Supplied vs borrowed">Supplied vs borrowed</section>
  ),
  PortfolioCompositionChart: () => (
    <section aria-label="Portfolio composition">Portfolio composition</section>
  ),
}));

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
  displayMode: "graphs" as const,
  onAddProfile: vi.fn(),
  onSelectProfile: vi.fn(),
  onRenameProfile: vi.fn(),
  onRemoveProfile: vi.fn(),
  onTogglePrivacy: vi.fn(),
  onDisplayModeChange: vi.fn(),
};

const insightViewProps = {
  panelOpen: true,
  refreshIntervalSeconds: 300,
  displayMode: "graphs" as const,
  onDisplayModeChange: vi.fn(),
};

describe("display mode", () => {
  it("switches between graphs and exact numbers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DisplayModeSwitcher value="graphs" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Graphs" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(screen.getByRole("button", { name: "Numbers" }));
    expect(onChange).toHaveBeenCalledWith("numbers");
  });
});

describe("settings", () => {
  it("lets the user choose the number shown in the menu bar", async () => {
    const user = userEvent.setup();
    const onMenuBarMetricChange = vi.fn();
    render(
      <SettingsView
        refreshIntervalSeconds={60}
        menuBarMetric="borrowed"
        profiles={[]}
        onRefreshIntervalChange={vi.fn()}
        onMenuBarMetricChange={onMenuBarMetricChange}
        onSelectProfile={vi.fn()}
        onRemoveProfile={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText("Menu-bar value"), "available");
    expect(onMenuBarMetricChange).toHaveBeenCalledWith("available");
  });
});

describe("insights", () => {
  it("defaults to the protocol capital graph and links to the full breakdown", async () => {
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());
    renderWithQuery(<InsightsView {...insightViewProps} />);

    expect(await screen.findByRole("heading", { name: "Insights" })).toBeVisible();
    expect(screen.getByText("Supplied vs borrowed")).toBeVisible();
    expect(screen.queryByText("Total supplied")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View full breakdown/ })).toBeVisible();
  });

  it("shows compact protocol and pool totals in numbers mode", async () => {
    const user = userEvent.setup();
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());
    function Harness() {
      const [displayMode, setDisplayMode] = useState<"graphs" | "numbers">("graphs");
      return (
        <InsightsView
          {...insightViewProps}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      );
    }
    renderWithQuery(<Harness />);

    await screen.findByRole("heading", { name: "Insights" });
    await user.click(screen.getByRole("button", { name: "Numbers" }));
    expect(screen.getByText("Total supplied")).toBeVisible();
    expect(screen.getByLabelText("Pool totals")).toBeVisible();
    expect(screen.getAllByText("BTC")[0]).toBeVisible();
    expect(screen.queryByText("Supplied vs borrowed")).not.toBeInTheDocument();
    expect(screen.getByText(/does not expose protocol history/)).toBeVisible();
  });

  it("retains cached insights when a refresh fails", async () => {
    const client = createClient();
    client.setQueryData(["markets"], marketSnapshotFixture());
    queryMocks.fetchMarkets.mockRejectedValue(new Error("offline"));
    renderWithQuery(<InsightsView {...insightViewProps} />, client);
    expect(await screen.findByText(/Refresh failed\. Showing data/)).toBeVisible();
    expect(screen.getByText("Supplied vs borrowed")).toBeVisible();
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

  it("uses a composition pie for a populated portfolio", async () => {
    queryMocks.fetchPortfolio.mockResolvedValue(portfolioFixture());
    renderWithQuery(<PortfolioView {...basePortfolioProps} />);
    expect(await screen.findByLabelText("Portfolio composition")).toBeVisible();
    expect(screen.getByRole("button", { name: "Graphs" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
