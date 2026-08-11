export type CheckoutReservationCandidate = {
  cartItemId: number;
  variantId: number;
  requestedQuantity: number;
  stock: number;
  reservedByOthers: number;
  active: boolean;
};

export type CheckoutReservationDecision = CheckoutReservationCandidate & {
  availableStock: number;
};

export function planCheckoutReservations(candidates: CheckoutReservationCandidate[]) {
  const renewable: CheckoutReservationDecision[] = [];
  const unavailable: CheckoutReservationDecision[] = [];

  for (const candidate of candidates) {
    const decision = {
      ...candidate,
      availableStock: Math.max(candidate.stock - candidate.reservedByOthers, 0),
    };
    if (candidate.active && candidate.requestedQuantity >= 1 && candidate.requestedQuantity <= decision.availableStock) {
      renewable.push(decision);
    } else {
      unavailable.push(decision);
    }
  }

  return { renewable, unavailable };
}
