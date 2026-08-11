import { createStoreIconImage } from "./store-icon-image";

export const size = { height: 64, width: 64 };
export const contentType = "image/png";

export default function Icon() {
  return createStoreIconImage(size.width);
}
