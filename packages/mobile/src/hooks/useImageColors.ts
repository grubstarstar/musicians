import { useEffect, useState } from "react";
import { getColors } from "react-native-image-colors";

interface ImageColors {
  background: string;
  textColor: string;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function useImageColors(
  uri: string,
  fallbackBackground: string
): ImageColors {
  const [colors, setColors] = useState<ImageColors>({
    background: fallbackBackground,
    textColor: "#fff",
  });

  useEffect(() => {
    let cancelled = false;

    getColors(uri, { cache: true, quality: "low" }).then((result) => {
      if (cancelled) return;

      let bg = fallbackBackground;
      if (result.platform === "ios") {
        bg = result.background;
      } else if (result.platform === "android") {
        bg = result.dominant;
      } else {
        bg = result.dominant;
      }

      const textColor = luminance(bg) > 0.179 ? "#000" : "#fff";
      setColors({ background: bg, textColor });
    });

    return () => {
      cancelled = true;
    };
  }, [uri, fallbackBackground]);

  return colors;
}
