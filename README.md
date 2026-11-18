# Gym Business OS (GymOS) — India's Premier Gym Management SaaS Platform

A multi-tenant, offline-ready, multi-branch Gym Business Operating System built with **Laravel 12 REST API**, **MySQL 8 / SQLite**, **React 19 + TypeScript + Vite PWA**, **Tailwind CSS**, **Lucide Icons**, **i18next Multilingual Support (English, Marathi, Hindi)**, and **Razorpay**.

---

## 1. Architectural Highlights

### Strict Multi-Tenant Isolation
- **Organization Tenant Level (`gyms`)**: Every business table contains `gym_id`. Queries are globally scoped via the `BelongsToGym` trait.
- **Fail-Closed Design**: If gym context is missing, queries automatically evaluate to `whereRaw('1 = 0')` — zero data leaks across gyms.
- **Location/Facility Level (`branches`)**: Hierarchical branch support (`Downtown Flagship`, `Bandra Studio`, etc.). Requests carry `X-Branch-ID`, verified against user permissions via `ResolveGymBranch` middleware.
- **Never Trust Client Tenant ID**: `gym_id` is derived strictly from the authenticated Sanctum token (`$user->gym_id`), never from request headers or input payloads.

### Production Multilingual System (EN + MR + HI)
- **3 Supported Languages**: English (`en`), Marathi / मराठी (`mr`), Hindi / हिन्दी (`hi`).
- **Global Native Switcher**: Available across Login, Navigation Sidebar, Settings, Member Pass, and Trainer Workspace.
- **Independent User Preferences**: Per-user DB persistence (`PUT /api/me/language`), guest preference in `localStorage`, and zero-reload reactive updates.
- **Regional Indian Formatters**: Indian currency numbering (`₹1,25,000.00`), localized dates, and Devanagari typography (`Noto Sans Devanagari`).
- **Backend Localization**: Laravel 12 `SetLocale` middleware, language dictionaries (`lang/en`, `lang/mr`, `lang/hi`), multilingual WhatsApp templates, and UTF-8 BOM CSV exports.

### Offline Outbox & Idempotent Transactions
- Gym front desk check-ins, fee collections, and member enrolments generate a persistent `client_uuid`.
- In offline scenarios (Wi-Fi dropouts), actions queue safely in `localStorage` scoped per gym.
- When reconnected, the browser fires auto-sync. The backend enforces unique `client_uuid` constraints, returning existing records without duplicate transactions or double billing.

### Inventory, WAC Costing & Retail POS
- Barcode scanning & quick lookup for supplements, merchandise, and gym gear.
- Real-time stock movement ledger, batch expiry warnings, and Weighted Average Costing (WAC).
- Sales counter with cash, UPI, card, and member ledger dues reconciliation.

### Business Intelligence, Action Center & WhatsApp
- Real-time Owner Dashboard with collections, expenses, and operating profit formula.
- Operational Action Center radar for expiring memberships, overdue dues, and inactive members.
- WhatsApp Business automation templates with token interpolation.
- AI Gym Business Advisor for revenue intelligence and churn prevention.

### Razorpay Subscription Billing
- Multi-tier SaaS plans: **Starter Studio** (1 branch), **Growth Club** (up to 3 branches), and **Enterprise Franchise** (unlimited branches).
- Automated trial management (14-day free trial).
- Expired plan lockdown (only billing routes remain accessible so gym owners can renew).

---

## 2. Directory Structure

```
GYM Guys/
├── backend/                  # Laravel 12 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/   # Auth, Dashboard, Branches, Members, Payments, Attendance, Billing, Admin
│   │   ├── Http/Middleware/        # EnsureGymAccess, EnsureSuperAdmin, ResolveGymBranch
│   │   ├── Models/                 # Gym, Branch, User, Member, MembershipPlan, Payment, AttendanceLog, SaasPlan
│   │   │   └── Concerns/           # BelongsToGym, BelongsToBranch (Global Scopes)
│   │   └── Support/                # CurrentGym, CurrentBranch (Thread-safe context singletons)
│   ├── database/migrations/        # 8 Database Migrations (Full schema)
│   ├── database/seeders/           # DatabaseSeeder (Flagship IronCore Fitness demo)
│   ├── routes/api.php              # REST API routes
│   └── tests/Feature/              # Automated Tenancy & Isolation Test Suites
│
└── frontend/                 # React 19 + TypeScript + Vite PWA
    ├── src/
    │   ├── api/client.ts           # Axios client with Auth & X-Branch-ID interceptors
    │   ├── context/AuthContext.tsx # Multi-branch auth store, offline state, impersonation
    │   ├── lib/outbox.ts           # Offline queue engine & idempotent sync
    │   ├── lib/whatsapp.ts         # WhatsApp message templates & dispatch generators
    │   ├── components/Layout.tsx   # Responsive desktop sidebar, mobile drawer, branch switcher
    │   ├── pages/                  # Dashboard, Attendance, Members, Payments, Packages, Branches, Staff, Billing, Settings
    │   └── pages/admin/            # Super Admin Control Plane
    └── vite.config.ts              # Vite PWA & Workbox setup
```

---

## 3. Pre-Seeded Demo Credentials

The database comes pre-seeded with **IronCore Fitness** (2 branches: Downtown Flagship & Bandra Studio), active members, payments, and attendance logs.

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Gym Owner** | `owner@ironcore.in` | `password123` | Full access across all branches, SaaS billing, settings, staff |
| **Branch Manager** | `manager@ironcore.in` | `password123` | Bandra Studio management, members, check-ins, fee collections |
| **Front Desk** | `reception@ironcore.in` | `password123` | Downtown Flagship check-in desk, POS payments, registrations |
| **Super Admin** | `admin@gymbusinessos.com` | `password123` | Platform control plane: manage all gyms, suspend/activate, impersonate |

---

## 4. Local Setup & Execution Guide

### Prerequisites
- PHP 8.2+
- Composer 2.x
- Node.js 18+ & npm
- SQLite or MySQL 8

### Backend Setup
```bash
cd backend

# 1. Environment configuration
copy .env.example .env

# 2. Database migration & seeding
php artisan migrate:fresh --seed

# 3. Start API server (port 8000)
php artisan serve
```

### Running Automated Tenancy Isolation Tests
```bash
cd backend
php artisan test
```
All 48 feature and unit tests (298 assertions) will execute, confirming:
- Gym B cannot query or touch Gym A's data (returns 404 / empty set)
- Gym B cannot write payments or attendance against Gym A's members
- Fail-closed tenant isolation without context
- Suspended and expired gym account lockdown
- Staff branch permissions isolation
- Outbox `client_uuid` idempotency
- Inventory stock movements, WAC recalculations, and POS checkout
- Business intelligence metrics and operating profit calculations
- Multilingual user language persistence, middleware resolution, and localized validation
- Security hardening (cross-tenant ID tampering, SQL injection, XSS)

### Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
# Running on http://localhost:5173

# 3. Production build
npm run build
```
