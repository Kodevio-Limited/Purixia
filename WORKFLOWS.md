# Purixia BD — Complete Workflow Catalog

All workflows in the project, with the exact code that implements them.

**Stack:** Next.js (App Router) + Zustand + TanStack Query → Django REST Framework + SimpleJWT

**Route mounting** — `backend/core/urls.py`:

```python
path('api/auth/',    include('apps.users.urls')),
path('api/catalog/', include('apps.catalog.urls')),
path('api/cart/',    include('apps.cart.urls')),
path('api/orders/',  include('apps.orders.urls')),
path('api/banners/', include('apps.banners.urls')),
```

---

## 1. Authentication Workflows

### 1.1 Register

- **Endpoint:** `POST /api/auth/register/`
- **Frontend:** `frontend/src/app/register/page.tsx` → `useRegister()` (`hooks/useAuth.ts`) → `authService.register` (`services/auth.ts`)

Backend — `backend/apps/users/views.py`:

```python
class RegisterView(generics.CreateAPIView):
    queryset            = User.objects.all()
    serializer_class    = RegisterSerializer
    authentication_classes = NO_SESSION_AUTH   # JWT, no CSRF/session
    permission_classes  = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {'user': UserSerializer(user).data, 'tokens': _token_response(user)},
            status=status.HTTP_201_CREATED,
        )
```

Serializer — `backend/apps/users/serializers.py`:

```python
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model  = User
        fields = ('id', 'email', 'username', 'password', 'phone')

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
```

Frontend — `frontend/src/app/register/page.tsx` (Zod validation + post-register cart sync):

```typescript
const registerSchema = z.object({
  username: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is too short').max(15, 'Phone number is too long'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
// ...
await registerMutation.mutateAsync(data);
toast.success('Account created successfully!');
```

Store — `frontend/src/stores/authStore.ts`:

```typescript
register: async (data) => {
  const response = await authService.register(data);
  saveTokens(response.tokens);                 // localStorage: access_token, refresh_token
  set({ user: response.user, loading: false });
  await useCartStore.getState().fetchCart();   // sync cart before marking logged-in
  set({ isLoggedIn: true });
  return response.user;
},
```

**Register redirect flow:** pages push unauthenticated users to `/register?redirect=<path>&add_to_cart=<productId>`; after signup the user is returned and the pending product is silently added (`register/page.tsx` → `addItemSilent`).

### 1.2 Login

- **Endpoint:** `POST /api/auth/login/`
- **Frontend:** `frontend/src/app/login/page.tsx` → `useLogin()` → `authService.login`

Backend — `backend/apps/users/views.py` + `serializers.py`:

```python
class LoginView(APIView):
    authentication_classes = NO_SESSION_AUTH
    permission_classes  = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return Response({'user': UserSerializer(user).data, 'tokens': _token_response(user)})

# serializers.py
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.check_password(data['password']):
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')
        data['user'] = user
        return data
```

### 1.3 Token issuance (shared helper)

`backend/apps/users/views.py`:

```python
def _token_response(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}
```

### 1.4 Token refresh (auto-retry interceptor)

- **Endpoint:** `POST /api/auth/token/refresh/`

Backend — `backend/apps/users/views.py`:

```python
class TokenRefreshView(BaseTokenRefresh):
    """Token refresh without CSRF enforcement (cross-origin frontend)."""
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]
```

Frontend — `frontend/src/lib/axios.ts` (request queue + retry on 401):

```typescript
api.interceptors.response.use(async (error) => {
  const originalRequest = error.config;
  if (error.response?.status === 401 && !originalRequest._retry) {
    // skip for auth endpoints themselves
    if (originalRequest.url === '/api/auth/token/refresh/' || ...) return Promise.reject(error);
    if (isRefreshing) { /* queue the request until refresh completes */ }
    originalRequest._retry = true;
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) { /* clear tokens → redirect to /register?redirect=... */ }
    const response = await axios.post(`${BASE_API}/api/auth/token/refresh/`, { refresh: refreshToken });
    localStorage.setItem('access_token', response.data.access);
    processQueue(null, response.data.access);
    return api(originalRequest);   // replay original request
  }
  return Promise.reject(error);
});
```

Every outgoing request gets `Authorization: Bearer <access_token>` from the request interceptor in the same file.

### 1.5 Logout (refresh-token blacklist)

- **Endpoint:** `POST /api/auth/logout/`

`backend/apps/users/views.py`:

```python
class LogoutView(APIView):
    """Blacklist the refresh token and clear session."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
        except Exception:
            return Response({'error': 'Invalid or expired token.'}, status=400)
        return Response({'message': 'Logged out.'}, status=205)
```

Frontend — `frontend/src/stores/authStore.ts`:

```typescript
logout: async () => {
  const refresh = getRefreshToken();
  if (refresh) await authService.logout(refresh).catch(...);
  clearTokens();
  set({ user: null, isLoggedIn: false, loading: false });
  await useCartStore.getState().fetchCart();   // reset to anonymous cart
},
```

### 1.6 Session bootstrap (`me`) + profile update

- **Endpoints:** `GET/PATCH /api/auth/me/`

`backend/apps/users/views.py`:

```python
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class   = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
```

Frontend — `frontend/src/stores/authStore.ts` `initAuth()` (called from `app/providers.tsx` on mount):

```typescript
initAuth: async () => {
  const token = getAccessToken();
  if (token) {
    try {
      const user = await authService.me();
      set({ user, isLoggedIn: true });
      await useCartStore.getState().fetchCart();
    } catch (error) {
      clearTokens();
      set({ user: null, isLoggedIn: false });
    }
  }
  set({ loading: false });
},
```

### 1.7 JWT authentication class (safe parse)

`backend/apps/users/auth.py`:

```python
class SafeJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            return None
```

### 1.8 Superuser bootstrap (deploy-time)

`backend/apps/users/management/commands/ensure_admin.py` — creates/updates the admin from env vars:

```python
class Command(BaseCommand):
    help = 'Create a superuser from env vars if none exists (or update password if ADMIN_RESET_PASSWORD=1)'
    # reads ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD
    # → User.objects.create_superuser(username=..., email=..., password=...)
```

Run by `backend/entrypoint.sh` on container start:

```sh
python manage.py migrate --noinput --settings=core.settings.prod
python manage.py ensure_admin --settings=core.settings.prod
python manage.py collectstatic --noinput --settings=core.settings.prod
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

---

## 2. Catalog Workflows (Categories, Products, Reviews)

Routing — `backend/apps/catalog/urls.py` (DRF router):

```python
router.register('categories', CategoryViewSet, basename='category')
router.register('products',   ProductViewSet,  basename='product')
```

### 2.1 Browse categories (public)

- **Endpoint:** `GET /api/catalog/categories/` (unpaginated), `GET /api/catalog/categories/<slug>/`
- **Frontend:** `useCategories()` hook → `catalogService.getCategories/getCategoryDetail`

`backend/apps/catalog/views.py`:

```python
class CategoryViewSet(viewsets.ModelViewSet):
    queryset         = Category.objects.all()
    lookup_field     = 'slug'
    pagination_class = None   # small lookup list

    def get_serializer_class(self):
        return CategoryListSerializer if self.action == 'list' else CategorySerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]
```

### 2.2 Browse products with filters + pagination (public)

- **Endpoint:** `GET /api/catalog/products/?category=<slug>&in_stock=true&offered=true&page=N`
- **Frontend:** `useProducts(params)` (`hooks/useProducts.ts`, 2-min staleTime, `keepPreviousData`)

`backend/apps/catalog/views.py`:

```python
def get_queryset(self):
    qs       = super().get_queryset()
    category = self.request.query_params.get('category')
    in_stock = self.request.query_params.get('in_stock')
    offered  = self.request.query_params.get('offered')
    if category:
        qs = qs.filter(category__slug=category)
    if in_stock is not None:
        qs = qs.filter(in_stock=in_stock.lower() == 'true')
    if offered is not None and offered.lower() == 'true':
        qs = qs.filter(discount_percent__gt=0)
    return qs
```

### 2.3 Product detail (public)

- **Endpoint:** `GET /api/catalog/products/<id>/` — includes `images`, `features`, `specifications`, `reviews`, `discounted_price`
- **Frontend:** `useProduct(id)` → `frontend/src/components/catalog/ProductDetail.tsx`

### 2.4 Create / update / delete a product (ADMIN)

Two paths exist:

**(a) Django Admin panel (primary path used by merchants)** — `backend/apps/catalog/admin.py`:

```python
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price_display', 'stock_badge', 'rating_stars', 'status_badge')
    list_filter  = ('category', 'in_stock', 'created_at')
    inlines      = [ProductImageInline, ProductFeatureInline, ProductSpecificationInline, ProductReviewInline]
    fieldsets    = (
        ('Basic Info',       {'fields': ('name', 'title', 'category', 'description')}),
        ('Pricing & Stock',  {'fields': ('price', 'discount_percent', 'quantity', 'in_stock'),
                              'description': 'Offer % set here drives the sale price shown on the site (0 = no offer).'}),
        ('Media',            {'fields': ('image',)}),
        ...
    )
```

**(b) REST API (staff only)** — `POST/PATCH/DELETE /api/catalog/products/`:

```python
class ProductViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]        # staff/superuser required
        if self.action == 'create_review':
            return [IsAuthenticated()]
        return [AllowAny()]
```

Categories and banners use the identical admin-write pattern.

### 2.5 Submit a product review (authenticated, delivered-order only)

- **Endpoint:** `POST /api/catalog/products/<id>/reviews/`
- **Frontend:** `ReviewModal.tsx` → `useSubmitReview()` (`hooks/useProducts.ts`) → `catalogService.createReview`

`backend/apps/catalog/views.py`:

```python
@action(detail=True, methods=['post'], url_path='reviews', permission_classes=[IsAuthenticated])
def create_review(self, request, pk=None):
    product = self.get_object()
    serializer = ProductReviewCreateSerializer(
        data=request.data, context={'request': request, 'product': product})
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        review = serializer.save()
    return Response({...}, status=status.HTTP_201_CREATED)
```

Validation rules — `backend/apps/catalog/serializers.py`:

```python
def validate(self, attrs):
    # rating 1..5, comment or title required
    if product is not None and not OrderItem.objects.filter(
        order__user=user, product=product,
        order__status=OrderStatus.DELIVERED,      # only delivered orders can review
    ).exists():
        raise serializers.ValidationError({'detail': 'You can review this product once your order is delivered.'})
    ...

def create(self, validated_data):
    if ProductReview.objects.filter(product=product, user=user).exists():
        raise serializers.ValidationError({'detail': 'You have already reviewed this product.'})
    review = ProductReview.objects.create(..., is_verified_purchase=has_purchased, **validated_data)
    refresh_product_rating(product)   # recompute Product.rating = avg(reviews)
    return review
```

After success the frontend invalidates `['products']`, `['product']`, `['orders']` queries and toasts.

---

## 3. Shopping Cart Workflows

### 3.1 Frontend cart (client-side source of truth)

- **Store:** `frontend/src/stores/cartStore.ts` (Zustand + `localStorage` key `purixia_cart`)
- **Hook:** `frontend/src/hooks/useCart.ts`
- **Drawer UI:** `components/cart/CartDrawer.tsx`, `CartItem.tsx`

```typescript
addItem: async (productId, quantity = 1, product?: any) => {
  const existing = items.find((i) => i.product.id === id);
  const newItems = existing
    ? items.map(i => i.product.id === id ? enrichItem({ ...i, quantity: i.quantity + quantity }) : i)
    : [...items, toCartItem(src, quantity)];
  const totals = computeTotals(newItems);
  saveCart({ items: newItems, ...totals });   // persist to localStorage
  set({ items: newItems, ...totals, loading: false });
  get().openDrawer();                          // slide-in drawer opens
},
```

Also exposes `addItemSilent` (no drawer — used by register/buy-now redirects), `updateItem`, `removeItem`, `clearCart`.

### 3.2 Backend session cart API (server-side mirror)

- **Endpoints:** `GET/POST/PATCH/DELETE /api/cart/`, `DELETE /api/cart/clear/`
- All public (`AllowAny`).

`backend/apps/cart/views.py`:

```python
class CartView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):                      # → {items, grand_total, count}
    def post(self, request):                     # {product_id, quantity} — validates in_stock
        product = Product.objects.get(id=request.data['product_id'], in_stock=True)
        cart.add(product, quantity=int(request.data.get('quantity', 1)))
    def patch(self, request):                    # update quantity
    def delete(self, request):                   # remove item

class CartClearView(APIView):
    def delete(self, request):
        Cart(request).clear()
```

Session-backed cart engine — `backend/apps/cart/cart.py`:

```python
class Cart:
    def __init__(self, request):
        self.session = request.session
        self.cart = self.session.get(CART_SESSION_KEY) or {}

    def add(self, product, quantity=1): ...
    def remove(self, product_id): ...
    def update(self, product_id, quantity): ...   # qty <= 0 removes
    def clear(self): ...

    @property
    def grand_total(self):
        return sum(Decimal(v['price']) * v['quantity'] for v in self.cart.values())
```

### 3.3 Cart sync on auth events

`authStore.ts` calls `useCartStore.getState().fetchCart()` after login, register, logout and `initAuth` so the cart state matches the session.

---

## 4. Checkout & Order Workflows

### 4.1 Checkout page (form → place order)

- **Page:** `frontend/src/app/checkout/page.tsx`
- **Auth gate:** redirects to `/register?redirect=/checkout&add_to_cart=<id>` when logged out.

Validation — Zod:

```typescript
const checkoutSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Invalid phone number'),
  address: z.string().min(5, 'Delivery address is required'),
  delivery_type: z.enum(['inside', 'outside']),
  payment_method: z.enum(['cod', 'card', 'bkash', 'nagad']),
});
```

Payload build + submit:

```typescript
const payload = {
  shipping_info: { name, email, phone, address },
  delivery_type: values.delivery_type,
  payment_method: values.payment_method,
  items: items.map(item => ({ product_id: item.product.id, quantity: item.quantity, price: item.price })),
};
const order = await placeOrderMutation.mutateAsync(payload);
setOrderSuccess({ id: String(order.id) });
useCartStore.getState().setCart({ items: [], grand_total: '0.00', count: 0 });
```

Shipping cost is computed client-side: `inside = 60`, `outside = 120`.

### 4.2 Place order (transactional stock decrement)

- **Endpoint:** `POST /api/orders/place/` (auth required)
- **Hook:** `usePlaceOrder()` (`hooks/useOrders.ts`) → `orderService.placeOrder`

`backend/apps/orders/views.py`:

```python
class PlaceOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _process_items(self, order, items):
        total = Decimal('0')
        for entry in items:
            product = Product.objects.select_for_update().get(id=product_id)   # row lock
            if product.quantity < qty:
                raise ValueError(f"Not enough stock for {product.name}. Available: {product.quantity} ...")
            OrderItem.objects.create(order=order, product=product, quantity=qty, unit_price=price)
            product.quantity -= qty
            if product.quantity <= 0:
                product.in_stock = False
            product.save()
            total += price * qty
        order.total_amount = total
        order.save()

    @transaction.atomic
    def post(self, request):
        cart = Cart(request)
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # items: request body wins, else fall back to session cart; empty → 400
        shipping = ShippingInfo.objects.create(**data['shipping_info'])
        order = Order.objects.create(user=request.user, shipping_info=shipping,
                                     delivery_type=..., payment_method=...)
        self._process_items(order, items_source)
        cart.clear()
        return Response(OrderSerializer(order).data, status=201)
```

Order model statuses — `backend/apps/orders/models.py`:

```python
class OrderStatus(models.TextChoices):
    PENDING   = 'pending'
    CONFIRMED = 'confirmed'
    SHIPPED   = 'shipped'
    DELIVERED = 'delivered'
    CANCELLED = 'cancelled'
```

### 4.3 Order history

- **Endpoint:** `GET /api/orders/` — own orders only
- **Page:** `frontend/src/app/orders/page.tsx` (auth-gated → `/register?redirect=/orders`)

`backend/apps/orders/views.py`:

```python
class OrderListView(generics.ListAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items')
```

### 4.4 Order detail

- **Endpoint:** `GET /api/orders/<id>/`
- **Page:** `frontend/src/app/orders/[id]/page.tsx` (auth-gated → `/login?redirect=/orders`)

```python
class OrderDetailView(generics.RetrieveAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)
```

`OrderSerializer` also returns `reviewed_product_ids` so the UI can show "Reviewed" instead of "Write a Review" (`backend/apps/orders/serializers.py`).

### 4.5 Order fulfillment (admin status workflow)

`backend/apps/orders/admin.py` — bulk actions drive the lifecycle:

```python
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    actions = ['mark_confirmed', 'mark_shipped', 'mark_delivered', 'mark_cancelled']

    def mark_confirmed(self, request, queryset):
        updated = queryset.update(status='confirmed')
        self.message_user(request, f'{updated} order(s) marked as confirmed.')
    # mark_shipped → 'shipped', mark_delivered → 'delivered', mark_cancelled → 'cancelled'
```

`pending → confirmed → shipped → delivered` (or `cancelled`). Only `delivered` unlocks product reviews (see §2.5).

---

## 5. Banner Workflows

- **Endpoint:** `GET /api/banners/` (public, `is_active=True`), write ops admin-only
- **Frontend:** `useBanners()` → `bannerService.getBanners` → `components/banners/BannerSlider.tsx` (homepage slider)

`backend/apps/banners/views.py`:

```python
class BannerViewSet(viewsets.ModelViewSet):
    queryset         = Banner.objects.filter(is_active=True)
    serializer_class  = BannerSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]
```

Banners are managed via Django admin (title, subtitle, image, is_active, order).

---

## 6. Route Protection / Redirect Workflow (frontend)

Guarded pages redirect anonymous users and preserve the destination:

| Page | Guard |
|---|---|
| `/checkout` | `/register?redirect=/checkout&add_to_cart=<id>` |
| `/orders` | `/register?redirect=/orders` |
| `/orders/[id]` | `/login?redirect=/orders` |

Axios 401 handler (`lib/axios.ts`) does the same on expired sessions:

```typescript
window.location.href = `/register?redirect=${encodeURIComponent(currentPath)}`;
```

`login`/`register` pages read `?redirect=` and return the user after auth.

---

## 7. App Bootstrap Workflow

`frontend/src/app/providers.tsx`:

```typescript
React.useEffect(() => {
  initializeAuth();            // authStore.initAuth → GET /api/auth/me/
  fetchCart().catch(() => {}); // hydrate cart from localStorage
}, [fetchCart, initializeAuth]);
```

Wraps the app in `QueryClientProvider`, `CartDrawer`, and `Toaster`.

---

## Quick endpoint index

| Method | Path | Auth | Workflow |
|---|---|---|---|
| POST | `/api/auth/register/` | public | Register |
| POST | `/api/auth/login/` | public | Login |
| POST | `/api/auth/logout/` | JWT | Logout (blacklist refresh) |
| POST | `/api/auth/token/refresh/` | public | Refresh access token |
| GET/PATCH | `/api/auth/me/` | JWT | Profile read/update |
| GET | `/api/catalog/categories/` | public | List categories |
| GET | `/api/catalog/categories/<slug>/` | public | Category detail + products |
| GET | `/api/catalog/products/` | public | List/filter products |
| GET | `/api/catalog/products/<id>/` | public | Product detail |
| POST/PATCH/DELETE | `/api/catalog/products/` | staff | Manage products |
| POST | `/api/catalog/products/<id>/reviews/` | JWT | Submit review (delivered orders) |
| POST/PATCH/DELETE | `/api/catalog/categories/` | staff | Manage categories |
| GET/POST/PATCH/DELETE | `/api/cart/` | public | Session cart CRUD |
| DELETE | `/api/cart/clear/` | public | Clear cart |
| POST | `/api/orders/place/` | JWT | Place order (stock decrement) |
| GET | `/api/orders/` | JWT | Order history |
| GET | `/api/orders/<id>/` | JWT | Order detail |
| GET | `/api/banners/` | public | Active banners |
| POST/PATCH/DELETE | `/api/banners/` | staff | Manage banners |
| * | `/admin/` | staff | Django admin (products, orders, banners, users) |
