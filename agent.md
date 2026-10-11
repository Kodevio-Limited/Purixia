# Purixia BD - Product Agent Information

## Overview
Purixia BD is a premier e-commerce platform specializing in high-quality gadgets and tech accessories in Bangladesh. The project is built with a modern stack featuring a Next.js frontend and a Django REST Framework (DRF) backend.

## Key Features
- **Modern UI/UX**: Built with React, Next.js, and Tailwind CSS for a fast, responsive, and premium shopping experience.
- **Dynamic Catalog**: Categorized products with detailed specifications, ratings, and stock status.
- **Secure Authentication**: JWT-based authentication for users with registration and profile management.
- **Shopping Cart**: Advanced cart management with real-time updates and persistence.
- **Checkout Flow**: Streamlined ordering process with multiple payment methods (Cash on Delivery, Card, bKash, Nagad) and delivery options.
- **Order Tracking**: Users can view their order history and status.

## Tech Stack
### Frontend
- **Framework**: Next.js 14+ (App Router)
- **State Management**: Zustand
- **Data Fetching**: Tanstack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS & Framer Motion
- **Icons**: Lucide React

### Backend
- **Framework**: Django & Django REST Framework
- **Server**: Gunicorn (gthread workers) behind Traefik
- **Database**: SQLite (Development) / PostgreSQL (Production)
- **Cache**: Redis when `REDIS_URL` is set, otherwise in-process memory
- **Authentication**: SimpleJWT (refresh-token rotation + blacklist)
- **Media**: Django File Storage for product images and banners

## Project Structure
- `frontend/`: Next.js application
  - `src/app/`: App router pages
  - `src/components/`: Reusable UI components
  - `src/hooks/`: Custom React hooks for data fetching and logic
  - `src/services/`: API service layers
  - `src/stores/`: Zustand stores for global state
- `backend/`: Django application
  - `apps/`: Modular Django apps (users, catalog, cart, orders, banners)
  - `core/`: Project settings and configurations

## Correctness & Production Notes
- **Pricing is server-authoritative.** Order line prices come from `Product.discounted_price`
  and delivery fees from `DELIVERY_CHARGE_INSIDE`/`DELIVERY_CHARGE_OUTSIDE`. Client-supplied
  prices are accepted but ignored.
- **Checkout is atomic.** Shipping info, order, items and stock decrements commit together or not
  at all; products are locked with `select_for_update()` in ascending id order to avoid deadlocks.
- **Health probe:** `GET /api/health/` (checks the DB) — used by Traefik and Docker health checks.
- **Load balancing:** Traefik spreads traffic across backend/frontend replicas; raise
  `deploy.replicas` in `docker-compose.yml` or run `docker compose up -d --scale backend=3`.
- **Docs:** see `WORKFLOWS.md` for the full workflow catalog and `SCALING.md` for the capacity plan
  (200–250 concurrent users).

## Development
To run the project locally:
1. **Backend**:
   - Navigate to `backend/`
   - Install dependencies: `pip install -r requirements.txt`
   - Run migrations: `python manage.py migrate`
   - Start server: `python manage.py runserver`
2. **Frontend**:
   - Navigate to `frontend/`
   - Install dependencies: `npm install`
   - Start development server: `npm run dev`

---
© 2026 Purixia BD. All rights reserved.
