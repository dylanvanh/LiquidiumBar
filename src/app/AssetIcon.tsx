import type { IconComponentProps } from "@web3icons/react";
import TokenBTC from "@web3icons/react/icons/tokens/TokenBTC";
import TokenICP from "@web3icons/react/icons/tokens/TokenICP";
import TokenUSDC from "@web3icons/react/icons/tokens/TokenUSDC";
import TokenUSDT from "@web3icons/react/icons/tokens/TokenUSDT";
import type { ComponentType } from "react";

const tokenIcons: Record<string, ComponentType<IconComponentProps>> = {
  BTC: TokenBTC,
  ICP: TokenICP,
  USDC: TokenUSDC,
  USDT: TokenUSDT,
};

export function AssetIcon({ symbol }: { symbol: string }) {
  const normalizedSymbol = symbol.toUpperCase();
  const Icon = tokenIcons[normalizedSymbol];

  return (
    <span className="asset-avatar" aria-hidden="true">
      {Icon ? (
        <Icon className="asset-icon" variant="branded" />
      ) : (
        <span className="asset-avatar-fallback">{normalizedSymbol.slice(0, 1)}</span>
      )}
    </span>
  );
}
