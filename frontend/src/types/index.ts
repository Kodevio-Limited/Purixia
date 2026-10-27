export interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  // Informational only (the "send link, never blocks" policy): login and
  // ordering never depend on it.
  email_verified: boolean;
}

// The backend returns only the access token; the refresh token travels in an
// HttpOnly cookie that JavaScript never sees.
export interface Tokens {
  access: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface RegisterPayload {
  email: string;
  password: string;
  username?: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  uid: string;
  token: string;
  new_password: string;
}

export interface EmailVerificationPayload {
  uid: string;
  token: string;
}

export interface Subcategory {
  id: number;
  category: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  image?: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  subcategories?: Subcategory[];
}

export interface CategoryDetail extends Category {
  products: Product[];
}

export interface ProductImage {
  id: number;
  image: string;
}

export interface ProductFeature {
  id: number;
  text: string;
  order: number;
}

export interface ProductSpecification {
  id: number;
  name: string;
  value: string;
  order: number;
}

export interface ProductReview {
  id: number;
  reviewer_name: string;
  rating: number;
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface ReviewSubmitPayload {
  rating: number;
  title?: string;
  comment?: string;
}

export interface Product {
  id: number;
  category: number;
  category_name?: string;
  category_slug?: string;
  subcategory?: number | null;
  subcategory_name?: string | null;
  subcategory_slug?: string | null;
  name: string;
  title: string;
  description: string;
  price: string;
  discount_percent: number;
  discounted_price: string;
  quantity: number;
  rating: string;
  in_stock: boolean;
  image: string | null;
  images: ProductImage[];
  // Only present on list/grid payloads (see ProductListSerializer).
  review_count?: number;
  // Only present on the product detail payload.
  features?: ProductFeature[];
  specifications?: ProductSpecification[];
  reviews?: ProductReview[];
  created_at: string;
  updated_at: string;
}

export interface CartProduct {
  id: number;
  name: string;
  price: string;
  image: string | null;
}

/**
 * Shape accepted when adding to the cart. A full `Product` satisfies it, and
 * the lighter product returned by the detail endpoint does too.
 */
export interface CartProductInput {
  id: number;
  name: string;
  price: string;
  discounted_price?: string;
  image?: string | null;
}

export interface CartMutationResponse {
  message: string;
  count: number;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
  price: string;
  total_price: string;
}

export interface CartResponse {
  items: CartItem[];
  grand_total: string;
  count: number;
}

export interface ShippingInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export type DeliveryType = 'inside' | 'outside';
export type PaymentMethod = 'cod' | 'card' | 'bkash' | 'nagad';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface Order {
  id: number;
  user: number;
  shipping_info: ShippingInfo;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  status: OrderStatus;
  /** Sum of line items, excluding delivery. Computed by the server. */
  subtotal: string;
  /** Delivery fee charged. Computed by the server. */
  delivery_charge: string;
  /** Grand total = subtotal + delivery_charge. Computed by the server. */
  total_amount: string;
  items: OrderItem[];
  reviewed_product_ids: number[];
  created_at: string;
}

export interface DeliveryOptions {
  inside: string;
  outside: string;
}

export interface CartItemInput {
  product_id: number;
  quantity: number;
  price: string;
}

export interface PlaceOrderPayload {
  shipping_info: ShippingInfo;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  items?: CartItemInput[];
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  is_active: boolean;
  order: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  error?: string;
  non_field_errors?: string[];
  [key: string]: string | string[] | undefined;
}
