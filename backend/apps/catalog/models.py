from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Category(models.Model):
    name       = models.CharField(max_length=200, unique=True)
    slug       = models.SlugField(unique=True)
    image      = models.ImageField(upload_to='categories/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    category    = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    name        = models.CharField(max_length=300)
    title       = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    price       = models.DecimalField(max_digits=10, decimal_places=2)
    # Offer set by admin in the admin panel. 0 = no offer.
    # Selling price = price * (100 - discount_percent) / 100.
    discount_percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Offer percentage set by admin (0-100). 0 means no offer.',
    )
    quantity    = models.PositiveIntegerField(default=0)
    rating      = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)
    in_stock    = models.BooleanField(default=True)
    image       = models.ImageField(upload_to='products/', blank=True, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def discounted_price(self):
        """Selling price after the admin-set offer. Equals price when no offer."""
        if not self.discount_percent:
            return self.price
        factor = (Decimal(100) - Decimal(self.discount_percent)) / Decimal(100)
        return (self.price * factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def save(self, *args, **kwargs):
        self.in_stock = self.quantity > 0
        super().save(*args, **kwargs)


class ProductFeature(models.Model):
    """One-line feature bullet (e.g. '1.96" AMOLED HD Display'). Max ~15 per product."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='features')
    text = models.CharField(max_length=300)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Feature for {self.product.name}: {self.text[:50]}"


class ProductSpecification(models.Model):
    """One specification table row (e.g. Brand -> Kospet)."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='specifications')
    name = models.CharField(max_length=200)
    value = models.CharField(max_length=500)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Spec for {self.product.name}: {self.name}"


class ProductReview(models.Model):
    """Product review.

    Two sources:
    - Created by admin in the admin panel (user is null).
    - Submitted by a logged-in user from their order page (user is set).
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='product_reviews',
        blank=True,
        null=True,
    )
    reviewer_name = models.CharField(max_length=200)
    rating = models.PositiveSmallIntegerField(
        default=5, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    title = models.CharField(max_length=300, blank=True)
    comment = models.TextField(blank=True)
    is_verified_purchase = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=('product', 'user'),
                condition=~models.Q(user=None),
                name='unique_user_review_per_product',
            )
        ]

    def __str__(self):
        return f"Review for {self.product.name} by {self.reviewer_name}"


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/gallery/')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Image for {self.product.name}"
