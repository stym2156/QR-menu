import type { ImgHTMLAttributes } from "react";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  unoptimized?: boolean;
};

export default function Image({
  fill,
  width,
  height,
  style,
  quality: _quality,
  unoptimized: _unoptimized,
  ...props
}: ImageProps) {
  return (
    <img
      {...props}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={{
        ...style,
        ...(fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }
          : null),
      }}
    />
  );
}
