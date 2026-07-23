import btcLogoUrl from "../assets/crypto/btc.svg";
import ethLogoUrl from "../assets/crypto/eth.svg";
import icpLogoUrl from "../assets/crypto/icp.svg";
import usdcLogoUrl from "../assets/crypto/usdc.svg";
import usdtLogoUrl from "../assets/crypto/usdt.svg";

const tokenLogoUrls: Record<string, string> = {
  BTC: btcLogoUrl,
  ETH: ethLogoUrl,
  ICP: icpLogoUrl,
  USDC: usdcLogoUrl,
  USDT: usdtLogoUrl,
};

export function AssetIcon({ symbol }: { symbol: string }) {
  const normalizedSymbol = symbol.toUpperCase();
  const tokenLogoUrl = tokenLogoUrls[normalizedSymbol];

  return (
    <span className="asset-avatar" aria-hidden="true">
      {tokenLogoUrl ? (
        <img className="asset-icon" src={tokenLogoUrl} alt="" />
      ) : (
        <span className="asset-avatar-fallback">{normalizedSymbol.slice(0, 1)}</span>
      )}
    </span>
  );
}
