export type CourierProvider = "ECONT" | "SPEEDY";
export type DeliveryMethod = "ADDRESS" | "OFFICE";
export type CheckoutPaymentMethod = "CASH_ON_DELIVERY" | "CARD";

export type ShippingOffice = {
  provider: CourierProvider;
  id: string;
  code?: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: "OFFICE" | "LOCKER";
  cardPaymentAllowed?: boolean;
};

export type ShippingAddress = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
};

export type CheckoutShippingInput = ShippingAddress & {
  courierProvider: CourierProvider;
  deliveryMethod: DeliveryMethod;
  officeId?: string;
  paymentMethod: CheckoutPaymentMethod;
};

export type ShippingQuote = {
  provider: CourierProvider;
  amount: number;
  currency: "EUR";
  originalAmount: number;
  originalCurrency: string;
  expectedDeliveryDate?: string;
  serviceId?: string;
  source: "LIVE" | "DEMO" | "FALLBACK";
  warning?: string;
};

export type PreparedShipping = ShippingQuote & {
  customerCost: number;
  office?: ShippingOffice;
};

export type ShipmentRequest = ShippingAddress & {
  orderId: number;
  courierProvider: CourierProvider;
  deliveryMethod: DeliveryMethod;
  office?: ShippingOffice;
  serviceId?: string;
  paymentMethod: CheckoutPaymentMethod;
  amountToCollect: number;
  weightKg: number;
  description: string;
};

export type CreatedShipment = {
  shipmentNumber: string;
  labelUrl?: string;
  status?: string;
  expectedDeliveryDate?: string;
};

export type ShipmentTrackingEvent = {
  code?: string;
  description: string;
  location?: string;
  occurredAt: string;
};

export type ShipmentTracking = {
  provider: CourierProvider;
  shipmentNumber: string;
  status: string;
  delivered: boolean;
  checkedAt: string;
  events: ShipmentTrackingEvent[];
};
