import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  marketSnapshotFixture,
  portfolioFixture,
  protocolActivityFixture,
} from "../test/fixtures";
import { ActivityView } from "./ActivityView";
import { AssetIcon } from "./AssetIcon";
import { DisplayModeSwitcher } from "./DisplayModeSwitcher";
import { InsightsView } from "./InsightsView";
import { PortfolioView } from "./PortfolioView";
import { SettingsView } from "./SettingsView";
import type { ProfileRecord } from "./storage";

const queryMocks = vi.hoisted(() => ({
  fetchMarkets: vi.fn(),
  fetchPortfolio: vi.fn(),
  fetchProtocolActivity: vi.fn(),
  resolveProfileInput: vi.fn(),
}));

vi.mock("./queries", () => queryMocks);
vi.mock("./DitherCharts", () => ({
  MarketValueChart: () => (
    <section aria-label="Supplied vs borrowed">Supplied vs borrowed</section>
  ),
  MarketCompositionChart: () => (
    <section aria-label="Market composition">Share of deposits</section>
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
  it("shows details first and switches to charts", async () => {
    // given
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DisplayModeSwitcher value="numbers" onChange={onChange} />);

    // when
    const displayModeButtons = screen.getAllByRole("button");
    await user.click(screen.getByRole("button", { name: "Charts" }));

    // then
    expect(displayModeButtons.map((button) => button.textContent)).toEqual([
      "Details",
      "Charts",
    ]);
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(onChange).toHaveBeenCalledWith("graphs");
  });
});

describe("asset icons", () => {
  it("renders local Liquidium logos for supported assets", () => {
    // given
    const supportedSymbols = ["BTC", "ETH", "ICP", "USDC", "USDT"];
    const initialSupportedSymbol = "BTC";

    // when
    const { container, rerender } = render(
      <AssetIcon symbol={initialSupportedSymbol} />
    );

    // then
    for (const supportedSymbol of supportedSymbols) {
      rerender(<AssetIcon symbol={supportedSymbol} />);
      expect(container.querySelector("img.asset-icon")).toHaveAttribute(
        "src",
        expect.stringMatching(/^(data:image\/svg\+xml|.*\.svg$)/)
      );
    }
  });

  it("renders an initial for an unknown asset", () => {
    // given
    const unknownSymbol = "NEW";

    // when
    render(<AssetIcon symbol={unknownSymbol} />);

    // then
    expect(screen.getByText("N")).toBeVisible();
  });
});

describe("settings", () => {
  it("offers one-to-five-minute refresh intervals", async () => {
    const user = userEvent.setup();
    const onMenuBarMetricChange = vi.fn();
    const onRefreshIntervalChange = vi.fn();
    render(
      <SettingsView
        refreshIntervalSeconds={300}
        menuBarMetric="none"
        profiles={[]}
        onRefreshIntervalChange={onRefreshIntervalChange}
        onMenuBarMetricChange={onMenuBarMetricChange}
        onSelectProfile={vi.fn()}
        onRemoveProfile={vi.fn()}
      />
    );

    const menuBarSelect = screen.getByLabelText("Menu-bar value");
    expect(menuBarSelect).toHaveValue("none");
    await user.selectOptions(menuBarSelect, "available");
    expect(onMenuBarMetricChange).toHaveBeenCalledWith("available");

    const refreshSelect = screen.getByLabelText("Refresh interval");
    expect(screen.getAllByRole("option", { name: /min/ })).toHaveLength(3);
    expect(screen.queryByRole("option", { name: /sec/ })).not.toBeInTheDocument();
    await user.selectOptions(refreshSelect, "60");
    expect(onRefreshIntervalChange).toHaveBeenCalledWith(60);
  });

  it("removes a saved profile without relying on a browser confirmation", async () => {
    const user = userEvent.setup();
    const onRemoveProfile = vi.fn();
    render(
      <SettingsView
        refreshIntervalSeconds={300}
        menuBarMetric="none"
        profiles={[{ id: "aaaaa-aa", label: "Main" }]}
        onRefreshIntervalChange={vi.fn()}
        onMenuBarMetricChange={vi.fn()}
        onSelectProfile={vi.fn()}
        onRemoveProfile={onRemoveProfile}
      />
    );

    await user.click(screen.getByRole("button", { name: "Remove Main" }));
    expect(onRemoveProfile).toHaveBeenCalledWith("aaaaa-aa");
  });
});

describe("insights", () => {
  it("shows totals and both protocol graphs in graph mode", async () => {
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());
    renderWithQuery(<InsightsView {...insightViewProps} />);

    expect(await screen.findByRole("heading", { name: "Insights" })).toBeVisible();
    expect(screen.getByText("Total supplied")).toBeVisible();
    expect(screen.getByText("Total borrowed")).toBeVisible();
    expect(screen.getByText("Total available")).toBeVisible();
    expect(screen.getByText("Supplied vs borrowed")).toBeVisible();
    expect(screen.getByText("Share of deposits")).toBeVisible();
    expect(screen.getByLabelText("Protocol totals")).toAppearBefore(
      screen.getByLabelText("Market composition")
    );
    expect(screen.getByLabelText("Market composition")).toAppearBefore(
      screen.getByLabelText("Supplied vs borrowed")
    );
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
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Total supplied")).toBeVisible();
    expect(screen.getByLabelText("Pool totals")).toBeVisible();
    expect(screen.getAllByText("BTC")[0]).toBeVisible();
    expect(screen.queryByText("Supplied vs borrowed")).not.toBeInTheDocument();
    expect(screen.getByText(/activity now has its own tab/)).toBeVisible();
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

describe("activity", () => {
  const activityViewProps = {
    panelOpen: true,
    refreshIntervalSeconds: 300,
  };

  it("lists recent protocol activity with amounts and relative ages", async () => {
    queryMocks.fetchProtocolActivity.mockResolvedValue(protocolActivityFixture());
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());
    renderWithQuery(<ActivityView {...activityViewProps} />);

    expect(await screen.findByRole("heading", { name: "Activity" })).toBeVisible();
    expect(screen.getByText(/Withdrawn 20.14 BTC/)).toBeVisible();
    expect(screen.getByText(/Repaid 38.5 USDC/)).toBeVisible();
    expect(screen.getByText(/Supplied 9,900 BTC/)).toBeVisible();
    expect(screen.getByText("3755.9187")).toBeVisible();
  });

  it("filters activity by operation", async () => {
    const user = userEvent.setup();
    queryMocks.fetchProtocolActivity.mockResolvedValue(protocolActivityFixture());
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());
    renderWithQuery(<ActivityView {...activityViewProps} />);

    await screen.findByText(/Repaid 38.5 USDC/);
    await user.click(screen.getByRole("button", { name: "Repay" }));

    expect(screen.getByText(/Repaid 38.5 USDC/)).toBeVisible();
    expect(screen.queryByText(/Withdrawn 20.14 BTC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Supplied 9,900 BTC/)).not.toBeInTheDocument();
  });

  it("keeps the asset logo aligned when an activity has no transaction ID", async () => {
    // given
    queryMocks.fetchProtocolActivity.mockResolvedValue(protocolActivityFixture());
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());

    // when
    renderWithQuery(<ActivityView {...activityViewProps} />);
    const activitySummary = await screen.findByText(/Supplied 9,900 BTC/);
    const activityRow = activitySummary.closest(".activity-row");

    // then
    expect(
      activityRow?.querySelector(".activity-txid-placeholder")
    ).toBeInTheDocument();
    expect(activityRow?.querySelector(".asset-avatar")).toBeInTheDocument();
  });

  it("shows an error state when the feed cannot be loaded", async () => {
    queryMocks.fetchProtocolActivity.mockRejectedValue(new Error("offline"));
    queryMocks.fetchMarkets.mockResolvedValue(marketSnapshotFixture());
    renderWithQuery(<ActivityView {...activityViewProps} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Activity unavailable");
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
    queryMocks.resolveProfileInput.mockRejectedValue({
      type: "invalid-profile",
      message:
        "Enter a valid Liquidium profile principal, Ethereum address, or Bitcoin address.",
    });
    await user.type(
      screen.getByLabelText("Profile principal or wallet address"),
      "not valid"
    );
    await user.click(screen.getByRole("button", { name: "Add profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("valid");
    expect(onAddProfile).not.toHaveBeenCalled();
  });

  it("resolves a linked wallet address before adding the profile", async () => {
    const user = userEvent.setup();
    const onAddProfile = vi.fn();
    const walletAddress = "0x1111111111111111111111111111111111111111";
    queryMocks.resolveProfileInput.mockResolvedValue("aaaaa-aa");
    renderWithQuery(
      <PortfolioView
        {...basePortfolioProps}
        profiles={[]}
        selectedProfileId={undefined}
        onAddProfile={onAddProfile}
      />
    );

    await user.type(
      screen.getByLabelText("Profile principal or wallet address"),
      walletAddress
    );
    await user.click(screen.getByRole("button", { name: "Add profile" }));

    await waitFor(() =>
      expect(onAddProfile).toHaveBeenCalledWith({
        id: "aaaaa-aa",
        label: "Profile 1",
      })
    );
    expect(queryMocks.resolveProfileInput).toHaveBeenCalledWith(walletAddress);
  });

  it("closes the add form and selects a second profile", async () => {
    const user = userEvent.setup();
    const firstProfile = { id: "aaaaa-aa", label: "Main" };
    const secondProfileId = "rrkah-fqaaa-aaaaa-aaaaq-cai";
    queryMocks.resolveProfileInput.mockResolvedValue(secondProfileId);
    queryMocks.fetchPortfolio.mockImplementation(async (profileId: string) =>
      portfolioFixture({ profileId, positions: [] })
    );

    function Harness() {
      const [profiles, setProfiles] = useState<ProfileRecord[]>([firstProfile]);
      const [selectedProfileId, setSelectedProfileId] = useState(firstProfile.id);

      return (
        <PortfolioView
          {...basePortfolioProps}
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          onAddProfile={(profile) => {
            setProfiles((current) => [...current, profile]);
            setSelectedProfileId(profile.id);
          }}
          onSelectProfile={setSelectedProfileId}
        />
      );
    }

    renderWithQuery(<Harness />);
    await screen.findByText("No active positions");
    await user.click(screen.getByRole("button", { name: "Add profile" }));
    await user.type(
      screen.getByLabelText("Profile principal or wallet address"),
      secondProfileId
    );
    await user.type(screen.getByLabelText(/Local label/), "Second");
    await user.click(screen.getByRole("button", { name: "Add profile" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Selected profile")).toHaveValue(secondProfileId)
    );
    expect(
      screen.queryByLabelText("Profile principal or wallet address")
    ).not.toBeInTheDocument();
    expect(queryMocks.fetchPortfolio).toHaveBeenCalledWith(secondProfileId);
  });

  it("explains when a wallet has no linked Liquidium profile", async () => {
    const user = userEvent.setup();
    queryMocks.resolveProfileInput.mockRejectedValue({
      type: "invalid-profile",
      message: "No Liquidium profile is linked to this wallet address.",
    });
    renderWithQuery(
      <PortfolioView
        {...basePortfolioProps}
        profiles={[]}
        selectedProfileId={undefined}
      />
    );

    await user.type(
      screen.getByLabelText("Profile principal or wallet address"),
      "bc1qexamplewalletaddress000000000000000000000"
    );
    await user.click(screen.getByRole("button", { name: "Add profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No Liquidium profile is linked"
    );
  });

  it("renders a valid empty portfolio", async () => {
    queryMocks.fetchPortfolio.mockResolvedValue(
      portfolioFixture({ positions: [], totalSuppliedUsd: undefined })
    );
    renderWithQuery(<PortfolioView {...basePortfolioProps} />);
    expect(await screen.findByText("No active positions")).toBeVisible();
  });

  it("removes the selected profile from its profile actions", async () => {
    const user = userEvent.setup();
    const mainProfile = { id: "aaaaa-aa", label: "Main" };
    const removedProfile = {
      id: "rrkah-fqaaa-aaaaa-aaaaq-cai",
      label: "Phantom 3",
    };
    queryMocks.fetchPortfolio.mockImplementation(async (profileId: string) =>
      portfolioFixture({ profileId, positions: [] })
    );

    function Harness() {
      const [profiles, setProfiles] = useState<ProfileRecord[]>([
        mainProfile,
        removedProfile,
      ]);
      const [selectedProfileId, setSelectedProfileId] = useState(removedProfile.id);

      return (
        <PortfolioView
          {...basePortfolioProps}
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          onSelectProfile={setSelectedProfileId}
          onRemoveProfile={(profileId) => {
            const nextProfiles = profiles.filter(({ id }) => id !== profileId);
            setProfiles(nextProfiles);
            if (selectedProfileId === profileId) {
              setSelectedProfileId(nextProfiles[0]?.id ?? "");
            }
          }}
        />
      );
    }

    renderWithQuery(<Harness />);

    await screen.findByText("No active positions");
    await user.click(screen.getByRole("button", { name: "More profile actions" }));
    expect(screen.getByLabelText("Profile label")).toHaveValue("Phantom 3");
    await user.click(screen.getByRole("button", { name: "Remove profile" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Selected profile")).toHaveValue(mainProfile.id)
    );
    expect(screen.queryByLabelText("Profile label")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Phantom 3" })).not.toBeInTheDocument();
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

  it("hides balances without showing unsupported collateral flags", async () => {
    const user = userEvent.setup();
    queryMocks.fetchPortfolio.mockResolvedValue(portfolioFixture());
    renderWithQuery(<PortfolioView {...basePortfolioProps} hideBalances />);
    expect(await screen.findAllByText("••••••")).not.toHaveLength(0);
    const btcLabel = screen.getAllByText("BTC").at(0);
    expect(btcLabel).toBeDefined();
    if (btcLabel) await user.click(btcLabel);
    expect(screen.queryByText("Collateral flag")).not.toBeInTheDocument();
  });

  it("uses a composition pie for a populated portfolio", async () => {
    queryMocks.fetchPortfolio.mockResolvedValue(portfolioFixture());
    renderWithQuery(<PortfolioView {...basePortfolioProps} />);
    expect(await screen.findByLabelText("Portfolio composition")).toBeVisible();
    expect(screen.getByRole("button", { name: "Charts" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
