import logoFile from "@/assets/breath-care-kart-logo.jpeg";
import { cn } from "@/lib/utils";

export const breathCareKartLogoUrl = logoFile;

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={breathCareKartLogoUrl}
      alt="Breath Care Kart"
      className={cn("object-contain", className)}
    />
  );
}