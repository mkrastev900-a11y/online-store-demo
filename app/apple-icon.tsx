import { createStoreIconImage } from "./store-icon-image";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return createStoreIconImage(size.width);
}
