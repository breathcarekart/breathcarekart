import logoAsset from "@/assets/breath-care-kart-logo.jpeg.asset.json";
import { cn } from "@/lib/utils";

export const breathCareKartLogoUrl = logoAsset.url;

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={breathCareKartLogoUrl}
      alt="Breath Care Kart"
      className={cn("object-contain", className)}
    />
  );
}