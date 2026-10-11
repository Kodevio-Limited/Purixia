# Purixia BD — Complete Workflow Catalog

All workflows in the project, with the exact code that implements them.

**Stack:** Next.js (App Router) + Zustand + TanStack Query → Django REST Framework + SimpleJWT

**Route mounting** — `backend/core/urls.py`:

```python
path('api/auth/',    include('apps.users.urls')),
path('api/catalog/', include('apps.catalog.urls')),
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
        # "Send link, never blocks": the verification email is best-effort and
        # signup always succeeds even if the mail server is down.
        send_email_verification_email(user)
        response = _auth_response(user)
        response.status_code = status.HTTP_201_CREATED
        return response
```

`_auth_response(user)` (`views.py`) returns `{'user': …, 'tokens': {'access': …}}`
and sets the refresh token as an HttpOnly cookie (see §1.4) — the body never
contains a refresh token, so JavaScript cannot exfiltrate it.

Serializer — `backend/apps/users/serializers.py`:

```python
class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)          # must be unique, case-insensitive
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=15)
    password = serializers.CharField(write_only=True, min_length=8)  # + Django password validators

    class Meta:
        model  = User
        fields = ('id', 'email', 'username', 'password', 'phone')

    def create(self, validated_data):
        # username is optional in the UI; derive a unique one from the email.
        username = (validated_data.pop('username', '') or '').strip()
        return User.objects.create_user(
            username=username or self._generate_username(validated_data['email']),
            **validated_data,
        )
```

**Rules:** email is required and unique (case-insensitive), password must satisfy Django's
validators (min 8 chars, not common/numeric), and a missing username is auto-generated from
the email local part (e.g. `shopper@example.com` → `shopper`, then `shopper1`, …).
The endpoint is rate limited with the `auth` throttle scope.

Frontend — `frontend/src/app/register/page.tsx` (Zod validation + post-register cart sync):

```typescript
const registerSchema = z.object({
  username: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is too short').max(15, 'Phone number is too long'),
  // Mirrors the backend Django password validators.
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
// ...
await registerMutation.mutateAsync(data);
toast.success('Account created successfully!');
```

Store — `frontend/src/stores/authStore.ts`:

```typescript
register: async (data) => {
  const response = await authService.register(data);
  saveTokens(response.tokens);                 // access token → memory only (lib/token.ts)
  set({ user: response.user, loading: false }); // user includes email_verified (informational)
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
        return _auth_response(user)   # access in body, refresh in HttpOnly cookie

# serializers.py
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        # filter().first(): legacy duplicate emails would make get() raise
        # MultipleObjectsReturned (a 500) instead of a clean 400.
        email = data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email).order_by('id').first()
        if user is None:
            User().set_password(data['password'])   # equalise timing (no user enumeration)
            raise serializers.ValidationError('Invalid credentials.')
        if not user.check_password(data['password']) or not user.is_active:
            raise serializers.ValidationError('Invalid credentials.')
        data['user'] = user
        return data
```

### 1.3 Token issuance (shared helper)

`backend/apps/users/views.py`:

```python
def _auth_response(user):
    """Access token in the body, refresh token in the HttpOnly cookie."""
    refresh = RefreshToken.for_user(user)
    response = Response(
        {'user': UserSerializer(user).data, 'tokens': {'access': str(refresh.access_token)}},
    )
    return set_refresh_cookie(response, str(refresh))   # apps/users/cookies.py
```

The cookie is host-only, `Path=/api/auth/` (the narrowest single path covering
`token/refresh/` and `logout/`), `SameSite=Lax`, `Secure` in production. No
endpoint ever returns a refresh token in a body.

### 1.4 Token refresh (auto-retry interceptor)

- **Endpoint:** `POST /api/auth/token/refresh/` — reads the refresh token from
  the **cookie** (a body `refresh` is accepted as a fallback for non-browser
  clients). No body is needed from the storefront: `withCredentials: true`
  sends the cookie automatically.
- **Rotation is ON** (`ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`): each
  refresh writes a **new** cookie and blacklists the old token. The rotated token
  is stripped from the response body — the reply contains only `access`.

Backend — `backend/apps/users/views.py`:

```python
class TokenRefreshView(BaseTokenRefresh):
    """Refresh via the HttpOnly cookie. The rotated refresh token goes back
    into the cookie and is stripped from the body."""

    def post(self, request, *args, **kwargs):
        raw = request.data.get('refresh') or refresh_token_from_cookie(request)
        if not raw:
            return Response({'detail': 'No refresh token provided.'}, status=400)
        serializer = self.get_serializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])        # blacklisted/expired → 401
        data = serializer.validated_data
        rotated = data.pop('refresh', None)
        response = Response(data)
        if rotated:
            set_refresh_cookie(response, rotated)
        return response
```

Frontend — `frontend/src/lib/axios.ts` (request queue + retry on 401):

```typescript
api.interceptors.response.use(async (error) => {
  const originalRequest = error.config;
  if (error.response?.status === 401 && !originalRequest._retry) {
    // skip for auth endpoints themselves (login/register/refresh/reset/verify)
    if (AUTH_URLS.includes(originalRequest.url)) return Promise.reject(error);
    if (isRefreshing) { /* queue the request until refresh completes */ }
    originalRequest._retry = true;
    // Single flight: the cookie rides along via withCredentials, no body.
    const response = await api.post('/api/auth/token/refresh/', {});
    setAccessToken(response.data.access);          // memory only (lib/token.ts)
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
    """Blacklist the refresh token and expire the cookie. The token comes
    from the HttpOnly cookie; a body token is accepted as a fallback."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = refresh_token_from_cookie(request) or request.data.get('refresh')
        if not refresh:
            return Response({'error': 'Refresh token is required.'}, status=400)
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except Exception:
            return Response({'error': 'Invalid or expired token.'}, status=400)
        response = Response({'message': 'Logged out.'}, status=205)
        return clear_refresh_cookie(response)   # expires the cookie (max-age 0)
```

Frontend — `frontend/src/stores/authStore.ts`:

```typescript
logout: async () => {
  // Cookie + access header ride along; the backend blacklists and clears.
  await authService.logout().catch(...);
  clearTokens();                               // drop the in-memory access token
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
  try {
    if (!getAccessToken()) {
      // A reload wipes the in-memory token: restore it silently via the
      // cookie. Throws for anonymous visitors (no cookie) → not logged in.
      const { access } = await authService.refreshSession();
      setAccessToken(access);
    }
    const user = await authService.me();
    set({ user, isLoggedIn: true });
    await useCartStore.getState().fetchCart();
  } catch {
    clearTokens();
    set({ user: null, isLoggedIn: false });
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

### 1.9 Password reset (single-use emailed link)

- **Endpoints:** `POST /api/auth/password/reset/` (`{email}`), `POST /api/auth/password/reset/confirm/` (`{uid, token, new_password}`)
- **Frontend:** `forgot-password/page.tsx` → `authService.requestPasswordReset`; `reset-password/page.tsx` (`?uid=&token=`) → `authService.confirmPasswordReset`
- **No user enumeration:** the request endpoint always answers the same 200, whether or not the email exists; it sends at most `THROTTLE_EMAIL_SEND` (default `5/hour`) messages (`email_send` scope).
- **Single-use:** the token is Django's `default_token_generator`, bound to the password hash — saving the new password kills the token, so a replayed link fails with 400. Expires after `PASSWORD_RESET_TIMEOUT` (default 24h).
- Sending is best-effort (`apps/users/emails.py`): a dead mail server never changes the answer and never breaks ordering.

### 1.10 Email verification ("send link, never blocks")

- **Signup** sends a verification link (`send_email_verification_email`); **endpoint** `POST /api/auth/verify-email/` (`{uid, token}`) flips `email_verified=True`.
- **Frontend:** `verify-email/page.tsx` (`?uid=&token=`) posts on mount and shows success/error.
- **Never blocks:** login, ordering and reviews ignore the flag — it only records that the address proved reachable.
- **No replay:** the token hash includes `email_verified` (`apps/users/tokens.py`), so confirming kills the link; a second click fails with 400.

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
def get_serializer_class(self):
    # Grid/list gets a compact payload (no features/specifications/reviews);
    # detail and writes get the full serializer.
    return ProductListSerializer if self.action == 'list' else ProductSerializer

def get_queryset(self):
    qs = super().get_queryset()

    if self.action == 'list':
        # One aggregate for review counts + one prefetch for gallery images.
        # order_by is explicit because annotate() adds GROUP BY, which disables
        # Meta.ordering and would make pagination results unstable.
        qs = (qs.annotate(review_count=Count('reviews'))
                .prefetch_related('images')
                .order_by('-created_at', '-id'))
    elif self.action == 'retrieve':
        qs = qs.prefetch_related('images', 'features', 'specifications', 'reviews')

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

**Performance:** list responses are bounded (a fixed handful of queries regardless of how
many products are returned) instead of the previous N+1 storm. Each list row also exposes
`review_count` so the UI does not need the full review list.

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

### 3.2 No server-side cart (removed)

The server-side session cart was **removed** (app `apps.cart`, endpoints `/api/cart/` and
`/api/cart/clear/`). Reasons:

- It was a second, never-used source of truth: the storefront's guest cart is the Zustand /
  `localStorage` store above, and no frontend module imported `services/cart.ts`.
- Every request that touched it (`Cart.__init__` writes an empty dict back into the session)
  created an anonymous `django_session` row, and session state is per-process state that does not
  survive multiple replicas.

Checkout now takes its line items from the request body **only** (`POST /api/orders/place/`), so
placing an order never creates a session row and never depends on per-process state.

### 3.3 Cart sync on auth events

`authStore.ts` calls `useCartStore.getState().fetchCart()` after login, register, logout and `initAuth`. `fetchCart()` re-reads the `purixia_cart` `localStorage` entry (it never calls the API), so the cart follows the browser, not the session.

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

Delivery fees are **owned by the server** (`DELIVERY_CHARGE_INSIDE` / `DELIVERY_CHARGE_OUTSIDE`,
default 60/120). The checkout page reads them from `GET /api/orders/delivery-options/` and only
uses the same numbers as a fallback until that request resolves. The client never decides what
is charged.

### 4.2 Place order (idempotent, rate-limited, transactional)

- **Endpoint:** `POST /api/orders/place/` (auth required)
- **Hook:** `usePlaceOrder()` (`hooks/useOrders.ts`) → `orderService.placeOrder`
- **Idempotency:** the storefront sends one `Idempotency-Key` header per checkout attempt
  (`createIdempotencyKey()` in `frontend/src/lib/utils.ts`). The key is stored on the order, so a
  replayed request returns that order with `200` instead of placing a second one. The unique
  constraint is `(user, idempotency_key)`, so one customer's key can never resolve to another's order.
- **Abuse protection (COD):** the `order` throttle scope (`THROTTLE_ORDER`, default `10/hour`, keyed
  per user) and `MAX_OPEN_ORDERS` (default `1`), the number of `pending`/`confirmed` orders one
  account may hold. Both are environment variables.

`backend/apps/orders/views.py`:

```python
class PlaceOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _merge_items(raw_entries):
        """Collapse repeated products into {product_id: total_quantity}."""

    @staticmethod
    def _create_order_items(order, merged_items):
        """Caller must run inside transaction.atomic().

        Locks rows with select_for_update() in ascending id order so two carts
        containing the same products cannot deadlock, and prices every line from
        product.discounted_price — never from the request body.
        """
        products = {p.id: p for p in Product.objects.select_for_update()
                                            .filter(id__in=merged_items).order_by('id')}
        subtotal = Decimal('0')
        for product_id in sorted(merged_items):
            product, quantity = products[product_id], merged_items[product_id]
            if quantity > product.quantity:
                raise StockError(f'Not enough stock for {product.name}. ...')
            unit_price = product.discounted_price          # server-authoritative
            OrderItem.objects.create(order=order, product=product,
                                     quantity=quantity, unit_price=unit_price)
            subtotal += unit_price * quantity
            product.quantity -= quantity
            product.in_stock = product.quantity > 0
            product.save(update_fields=['quantity', 'in_stock', 'updated_at'])
        return subtotal

    throttle_classes = [ScopedRateThrottle]   # scope 'order' — THROTTLE_ORDER=10/hour
    throttle_scope   = 'order'

    def post(self, request):
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Seen this key before? Then this is a retry of an attempt that already
        # succeeded: return that order (200) instead of creating a second one.
        idempotency_key = self._idempotency_key(request)
        if idempotency_key:
            replayed = self._find_existing(request.user, idempotency_key)
            if replayed is not None:
                return Response(OrderSerializer(replayed, ...).data, status=200)

        # Items come from the body only: there is no server-side session cart.
        merged_items = self._merge_items(data.get('items') or [])
        if not merged_items:
            return Response({'error': 'Your cart is empty. ...'}, status=400)

        # COD abuse cap: one unpaid order at a time (MAX_OPEN_ORDERS). Checked
        # after the replay above, so a retry is never blocked by its own order.
        if open_orders >= settings.MAX_OPEN_ORDERS:
            return Response({'error': 'You already have an order awaiting confirmation. ...'},
                            status=409)

        try:
            # ONE unit of work. Any failure rolls back the shipping record,
            # the order, its items and every stock decrement.
            with transaction.atomic():
                shipping = ShippingInfo.objects.create(**data['shipping_info'])
                order = Order.objects.create(user=request.user, shipping_info=shipping,
                                             delivery_type=data['delivery_type'],
                                             payment_method=data['payment_method'],
                                             idempotency_key=idempotency_key or None)
                subtotal = self._create_order_items(order, merged_items)
                order.delivery_charge = delivery_charge_for(order.delivery_type)
                order.total_amount = subtotal + order.delivery_charge
                order.save(update_fields=['delivery_charge', 'total_amount', 'updated_at'])
        except IntegrityError:
            # Two identical requests raced and the unique constraint let one win:
            # return the winner so the loser still gets an idempotent success.
            replayed = self._find_existing(request.user, idempotency_key) if idempotency_key else None
            return Response(OrderSerializer(replayed, ...).data, status=200)
        except StockError as exc:
            return Response({'error': str(exc)}, status=400)
        except Exception:
            logger.exception('Order placement failed for user_id=%s', request.user.pk)
            return Response({'error': 'Order placement failed. Please try again.'}, status=500)

        return Response(OrderSerializer(order, context={'request': request}).data, status=201)
```

**Money model:** `Order.subtotal` = sum of line items, `Order.delivery_charge` = fee for the chosen
`delivery_type`, `Order.total_amount` = subtotal + delivery_charge. All three are returned by
`OrderSerializer`; `subtotal` is exposed read-only as a string so the receipt always matches the
server. `OrderItem.unit_price` is the catalog's discounted selling price at purchase time.

**Rollback guarantee:** the try/except sits *outside* `transaction.atomic()`, so a rejected order
commits nothing (previously a caught error inside the atomic block committed partial orders).

**Delivery details (`ShippingInfoSerializer`):** COD is only as good as the details we ship
against, so the phone must be a reachable Bangladeshi mobile number (`01XXXXXXXXX` or
`+8801XXXXXXXXX`; separators are stripped and the canonical national form is stored) and the
address must be 10-500 characters containing letters. The checkout form
(`frontend/src/app/checkout/page.tsx`) mirrors these rules so the customer is told before the
request is sent.

Order model statuses and the legal moves — `backend/apps/orders/models.py`:

```python
class OrderStatus(models.TextChoices):
    PENDING   = 'pending'
    CONFIRMED = 'confirmed'
    SHIPPED   = 'shipped'
    DELIVERED = 'delivered'
    CANCELLED = 'cancelled'

OPEN_STATUSES = (OrderStatus.PENDING, OrderStatus.CONFIRMED)   # still owe a delivery

ALLOWED_STATUS_TRANSITIONS = {
    OrderStatus.PENDING:   {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED:   {OrderStatus.DELIVERED, OrderStatus.CANCELLED},
    OrderStatus.DELIVERED: set(),      # final
    OrderStatus.CANCELLED: set(),      # final
}

class Order:
    def transition_to(self, new_status):
        """Move the order, or raise InvalidStatusTransition.

        Re-reads the row under select_for_update() so two admins cancelling the
        same order cannot both restore its stock, and cancelling puts every
        line item's quantity back into the catalog exactly once.
        """
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
    form = OrderAdminForm            # clean_status() refuses an illegal jump
    actions = ['mark_confirmed', 'mark_shipped', 'mark_delivered', 'mark_cancelled']

    def save_model(self, request, obj, form, change):
        """Route a status change through Order.transition_to() so the rules and
        the stock restore apply even when the form was bypassed."""

    def mark_cancelled(self, request, queryset):
        # Every bulk action now calls order.transition_to(...) instead of
        # queryset.update(), so illegal moves are skipped (and reported) and
        # cancelling restores stock.
        self._transition_selected(request, queryset, OrderStatus.CANCELLED, 'cancelled')
```

`pending → confirmed → shipped → delivered` (or `cancelled` from any non-final state). Every other
move — skipping a step (`pending → delivered`), going backwards, or cancelling a `delivered` order —
is refused by `Order.transition_to()`, which the API, the change form and the bulk actions all use.
Only `delivered` unlocks product reviews (see §2.5).

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
| POST | `/api/auth/register/` | public | Register (sends verification email, sets refresh cookie) |
| POST | `/api/auth/login/` | public | Login (sets refresh cookie) |
| POST | `/api/auth/logout/` | JWT | Logout (blacklists cookie refresh, expires cookie) |
| POST | `/api/auth/token/refresh/` | cookie | Refresh access token (rotates cookie, body has access only) |
| GET/PATCH | `/api/auth/me/` | JWT | Profile read/update |
| POST | `/api/auth/password/reset/` | public | Request reset link (same 200 either way, `email_send` throttle) |
| POST | `/api/auth/password/reset/confirm/` | public | Set new password (single-use expiring link) |
| POST | `/api/auth/verify-email/` | public | Confirm email (sets `email_verified`, never blocks) |
| GET | `/api/catalog/categories/` | public | List categories |
| GET | `/api/catalog/categories/<slug>/` | public | Category detail + products |
| GET | `/api/catalog/products/` | public | List/filter products |
| GET | `/api/catalog/products/<id>/` | public | Product detail |
| POST/PATCH/DELETE | `/api/catalog/products/` | staff | Manage products |
| POST | `/api/catalog/products/<id>/reviews/` | JWT | Submit review (delivered orders) |
| POST/PATCH/DELETE | `/api/catalog/categories/` | staff | Manage categories |
| POST | `/api/orders/place/` | JWT | Place order (idempotent via `Idempotency-Key`, server pricing + stock decrement, atomic, 10/hour + 1 open order) |
| GET | `/api/orders/` | JWT | Order history |
| GET | `/api/orders/<id>/` | JWT | Order detail |
| GET | `/api/orders/delivery-options/` | public | Authoritative delivery fees |
| GET | `/api/health/` | public | Readiness probe (checks DB + cache, 503 on failure) |
| GET | `/api/health/live/` | public | Liveness probe (process only, no dependencies) |
| GET | `/api/banners/` | public | Active banners |
| POST/PATCH/DELETE | `/api/banners/` | staff | Manage banners |
| * | `/admin/` | staff | Django admin (products, orders, banners, users) |

---

## 8. Production Hardening & Load Balancing

Behaviour that the runtime guarantees on top of the workflows above.

### 8.1 Security

| Concern | Behaviour |
|---|---|
| Startup secrets | Boot fails with `ImproperlyConfigured` when `SECRET_KEY` is missing, under 32 chars, or a known placeholder; when `ALLOWED_HOSTS` is empty or `*`; when the DB password is missing; or when `REDIS_URL` is unset |
| Order pricing | Line items and delivery fees are always resolved server-side; a client-supplied `price` is accepted but ignored |
| Email uniqueness | Registration rejects a duplicate email case-insensitively; login tolerates legacy duplicates without a 500 |
| Login timing | A dummy hash is computed for unknown emails so login cannot enumerate accounts |
| Passwords | Django validators + min length 8 on registration |
| Refresh token | HttpOnly cookie only: host-only, `Path=/api/auth/`, `SameSite=Lax`, `Secure` in prod. Never in a body, localStorage or JS. Rotation blacklists the old token; reuse → 401 |
| Access token | Short-lived, in memory only (frontend `lib/token.ts`); silent cookie refresh on page load; 401 → single-flight refresh + retry queue, clean logout on failure |
| Password reset | Emailed link is single-use (bound to password hash) and expiring; replay → 400. Request endpoint never reveals whether an email exists; `email_send` throttle (5/hour) |
| Email verification | Link sent on signup, `verify-email/` flips `email_verified`; replay → 400. Never blocks login, ordering or reviews |
| Rate limiting | `auth` scope 20/min on register/login/refresh; `anon` 240/min and `user` 4000/hour globally (env-tunable) |
| CORS | Explicit allow-list only (`CORS_ALLOWED_ORIGINS`); no wildcard, no origin echo |
| Hosts | `ALLOWED_HOSTS` must be explicit — a `*` fails the boot with `ImproperlyConfigured` |
| Anonymous sessions | Checkout has no server-side cart, so placing an order never creates a `django_session` row (the client cart is `localStorage`) |
| Order idempotency | `Idempotency-Key` (8-64 chars) is stored per user: a replayed key answers `200` with the existing order, and a simultaneous race is resolved by the unique constraint so exactly one order exists |
| COD abuse caps | `order` throttle scope (`THROTTLE_ORDER`, 10/hour per user) and `MAX_OPEN_ORDERS` (1) unpaid order per account — both env-tunable |
| Delivery details | Phone must be a dialable Bangladeshi mobile number (stored canonically as `01XXXXXXXXX`); address must be 10-500 characters containing letters |
| Status flow | Illegal order status moves are refused everywhere; cancelling restores stock exactly once, under a row lock |
| Input shaping | Checkout rejects non-numeric/zero quantities and an empty item list with 400 instead of raising 500 |

### 8.2 Concurrency & load balancing

- **Gunicorn** runs `gthread` workers (`workers = min(2*CPU+1, 8)`, `threads = 4` by default,
  env-tunable via `GUNICORN_*`; compose pins `4 x 8`) with `max_requests` recycling — see
  `backend/gunicorn.conf.py`.
- **Traefik** (already in Dokploy) is the load balancer. `deploy.replicas` on the `backend` and
  `frontend` services fans requests across replicas; `docker compose up -d --scale backend=3`
  works too.
- **Health checks:** Traefik only routes to replicas answering `GET /api/health/` (backend) and
  `GET /api/health` (frontend). Docker `HEALTHCHECK` mirrors this for Compose.
  - `GET /api/health/` is **readiness**: it probes the database *and* the shared cache and
    returns 503 if either is down, so a replica that cannot serve traffic leaves rotation.
  - `GET /api/health/live/` is **liveness**: dependency-free, so a brief DB/Redis blip does not
    make an orchestrator restart a healthy container.
- **Shared state:** Postgres holds sessions and the refresh-token blacklist; Redis is the shared
  cache for rate limiting. `REDIS_URL` is **required** in production (boot fails without it) so
  counters are global across replicas instead of per-worker.
- **Concurrency budget:** `GUNICORN_WORKERS` x `GUNICORN_THREADS` sets in-flight capacity per
  replica (compose default 4 x 8 = 32). Each worker costs ~50 MB RSS. Django holds a persistent
  DB connection **per handling thread**, so budget `replicas x workers x threads` connections
  (2 x 4 x 8 = 64 today) against Postgres `max_connections` — see `DEPLOYMENT.md`. The default
  worker count is capped at 8 because `cpu_count()` reports the host's cores inside a container.
- **Worker recycling:** `max_requests` (default 5000 ± 100 jitter) recycles Gunicorn workers to
  contain slow leaks. Recycling briefly closes connections the load balancer may still hold, which
  is why deploys **drain** a replica before restarting it (see `DEPLOYMENT.md`).
- **Drain on restart:** `stop_grace_period: 40s` on the backend exceeds Gunicorn's
  `graceful_timeout` (30s), so a rolling restart finishes in-flight requests instead of
  SIGKILLing them.
- **Migrations:** `migrate` runs once in a dedicated one-shot service before replicas start
  (`MIGRATE_ON_BOOT=0` on the replicas) so scaling out never races schema changes.

### 8.3 Media & static

- Static assets are compressed and served by WhiteNoise (`CompressedStaticFilesStorage`,
  30-day cache headers). Media uploads are served from the shared `media_data` volume.
- For multi-host scaling, move media to object storage — see `SCALING.md`.
