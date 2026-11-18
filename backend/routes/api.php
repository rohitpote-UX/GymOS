<?php

use App\Http\Controllers\Api\Admin\GymController as AdminGymController;
use App\Http\Controllers\Api\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\BrandingController;
use App\Http\Controllers\Api\CashClosingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\MemberMembershipController;
use App\Http\Controllers\Api\MembershipPlanController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfitabilityController;
use App\Http\Controllers\Api\PurchaseInvoiceController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TrainerController;
use Illuminate\Support\Facades\Route;

// -------------------------------------------------------------
// 1. PUBLIC ROUTES
// -------------------------------------------------------------
Route::post('/register', [AuthController::class, 'registerGym'])->middleware('throttle:15,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/billing/webhook', [BillingController::class, 'webhook']);

// Public branding & PWA manifest endpoints
Route::get('/branding', [BrandingController::class, 'platform']);
Route::get('/manifest.webmanifest', [BrandingController::class, 'platformManifest']);
Route::get('/gyms/{slug}/branding', [BrandingController::class, 'gym']);
Route::get('/gyms/{slug}/manifest.webmanifest', [BrandingController::class, 'gymManifest']);
Route::get('/gyms/{slug}/icons/{kind}.png', [BrandingController::class, 'icon']);

// -------------------------------------------------------------
// 2. AUTHENTICATED COMMON ROUTES
// -------------------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/me/password', [AuthController::class, 'changePassword']);
});

// -------------------------------------------------------------
// 3. SUPER ADMIN PLATFORM MANAGEMENT
// -------------------------------------------------------------
Route::middleware(['auth:sanctum', 'super.admin'])->prefix('admin')->group(function () {
    Route::get('/overview', [AdminGymController::class, 'overview']);
    Route::get('/gyms', [AdminGymController::class, 'index']);
    Route::get('/gyms/{id}', [AdminGymController::class, 'show']);
    Route::post('/gyms/{id}/suspend', [AdminGymController::class, 'suspend']);
    Route::post('/gyms/{id}/activate', [AdminGymController::class, 'activate']);
    Route::post('/gyms/{id}/extend-subscription', [AdminGymController::class, 'extendSubscription']);
    Route::post('/gyms/{id}/impersonate', [AdminGymController::class, 'impersonate']);
    Route::get('/audit', [AdminGymController::class, 'auditLog']);

    Route::apiResource('plans', AdminPlanController::class);
});

// -------------------------------------------------------------
// 4. TENANT GYM BUSINESS OS ROUTES (Scoped to CurrentGym & CurrentBranch)
// -------------------------------------------------------------
Route::middleware(['auth:sanctum', 'gym', 'branch'])->group(function () {
    // Executive Dashboard
    Route::get('/dashboard', DashboardController::class);

    // Multi-Branch Management
    Route::apiResource('branches', BranchController::class);

    // User & Staff Management (with role/permission matrix)
    Route::apiResource('staff', StaffController::class);

    // Module 1: Member Management
    Route::apiResource('members', MemberController::class);
    Route::post('/members/{id}/photo', [MemberController::class, 'updatePhoto']);
    Route::get('/members/{id}/qr-code', [MemberController::class, 'qrCode']);

    // Module 2: Membership Plans & Subscriptions Lifecycle
    Route::apiResource('membership-plans', MembershipPlanController::class);
    Route::post('/member-memberships/renew', [MemberMembershipController::class, 'renew']);
    Route::post('/member-memberships/{id}/freeze', [MemberMembershipController::class, 'freeze']);
    Route::post('/member-memberships/{id}/unfreeze', [MemberMembershipController::class, 'unfreeze']);
    Route::post('/member-memberships/{id}/extend', [MemberMembershipController::class, 'extend']);
    Route::post('/member-memberships/{id}/cancel', [MemberMembershipController::class, 'cancel']);

    // Module 3: Attendance & Access Control
    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
    Route::post('/attendance/qr-check-in', [AttendanceController::class, 'qrCheckIn']);
    Route::post('/attendance/{id}/check-out', [AttendanceController::class, 'checkOut']);
    Route::get('/attendance/today-stats', [AttendanceController::class, 'todayStats']);

    // Module 4: Financial Management & Payments
    Route::apiResource('payments', PaymentController::class)->only(['index', 'store', 'show']);
    Route::post('/payments/{id}/refund', [PaymentController::class, 'refund']);

    // Daily Cash Closing Register
    Route::get('/cash-closings/current', [CashClosingController::class, 'current']);
    Route::post('/cash-closings/close', [CashClosingController::class, 'close']);
    Route::get('/cash-closings/history', [CashClosingController::class, 'history']);

    // Module 5: Expense Management
    Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
    Route::apiResource('expenses', ExpenseController::class);

    // Module 6: Staff, Trainers & PT
    Route::get('/trainers', [TrainerController::class, 'index']);
    Route::post('/trainers/{id}/assign-member', [TrainerController::class, 'assignMember']);
    Route::get('/pt-sessions', [TrainerController::class, 'sessions']);
    Route::post('/pt-sessions', [TrainerController::class, 'scheduleSession']);
    Route::post('/pt-sessions/{id}/complete', [TrainerController::class, 'completeSession']);
    Route::get('/staff-leaves', [TrainerController::class, 'leaves']);
    Route::post('/staff-leaves', [TrainerController::class, 'requestLeave']);
    Route::post('/staff-leaves/{id}/review', [TrainerController::class, 'reviewLeave']);
    Route::get('/trainers/performance-report', [TrainerController::class, 'performanceReport']);

    // Module 7: Leads & CRM
    Route::get('/leads/stats', [LeadController::class, 'stats']);
    Route::apiResource('leads', LeadController::class);
    Route::post('/leads/{id}/follow-up', [LeadController::class, 'addFollowup']);
    Route::post('/leads/{id}/book-trial', [LeadController::class, 'bookTrial']);
    Route::post('/leads/{id}/convert', [LeadController::class, 'convert']);
    Route::post('/leads/{id}/mark-lost', [LeadController::class, 'markLost']);

    // Module 8: Analytics & Reporting
    Route::get('/reports/daily', [ReportController::class, 'daily']);
    Route::get('/reports/monthly', [ReportController::class, 'monthly']);
    Route::get('/reports/memberships', [ReportController::class, 'memberships']);
    Route::get('/reports/attendance', [ReportController::class, 'attendance']);
    Route::get('/reports/dues', [ReportController::class, 'dues']);
    Route::get('/reports/expenses', [ReportController::class, 'expenses']);
    Route::get('/reports/branch-revenue', [ReportController::class, 'branchRevenue']);
    Route::get('/reports/export/{type}', [ReportController::class, 'exportCsv']);

    // SaaS Subscription Billing
    Route::get('/billing', [BillingController::class, 'index'])->name('billing.index');
    Route::post('/billing/order', [BillingController::class, 'order'])->name('billing.order');
    Route::post('/billing/verify', [BillingController::class, 'verify'])->name('billing.verify');

    // Gym Settings & Dynamic Branding
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::post('/settings/logo', [SettingsController::class, 'uploadLogo']);
    Route::delete('/settings/logo', [SettingsController::class, 'removeLogo']);

    // Tenant Audit Trail
    Route::get('/audit-logs', [AuditLogController::class, 'index']);

    // =========================================================
    // PROMPT 03: GYM INVENTORY, SUPPLEMENT POS & PROFITABILITY
    // =========================================================

    // 1. Products Master Catalog & Barcode Scanner Lookup
    Route::get('/products/categories', [ProductController::class, 'categories']);
    Route::get('/products/barcode/{code}', [ProductController::class, 'barcodeLookup']);
    Route::apiResource('products', ProductController::class);

    // 2. Inventory Movements, Stock Adjustments, Low Stock & Batches
    Route::get('/inventory/movements', [InventoryController::class, 'movements']);
    Route::post('/inventory/adjust', [InventoryController::class, 'adjustStock']);
    Route::get('/inventory/low-stock', [InventoryController::class, 'lowStockAlerts']);
    Route::get('/inventory/expiring', [InventoryController::class, 'expiringAlerts']);
    Route::post('/inventory/transfers', [InventoryController::class, 'transferStock']);

    // 3. Suppliers Management, Ledgers & Payments
    Route::get('/suppliers/{id}/ledger', [SupplierController::class, 'ledger']);
    Route::post('/suppliers/{id}/payments', [SupplierController::class, 'recordPayment']);
    Route::apiResource('suppliers', SupplierController::class);

    // 4. Purchase Invoices (Goods Inward & Weighted Average Costing)
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class)->only(['index', 'store', 'show']);

    // 5. Point of Sale (POS) Reception Checkout & Refunds
    Route::post('/pos/checkout', [PosController::class, 'checkout']);
    Route::get('/pos/orders', [PosController::class, 'orders']);
    Route::get('/pos/orders/{id}', [PosController::class, 'show']);
    Route::post('/pos/orders/{id}/refund', [PosController::class, 'refund']);

    // 6. Profitability Engine, COGS, Margins & Valuation
    Route::get('/profitability/overview', [ProfitabilityController::class, 'overview']);
    Route::get('/profitability/product-performance', [ProfitabilityController::class, 'productPerformance']);
    Route::get('/profitability/slow-moving', [ProfitabilityController::class, 'slowMoving']);
    Route::get('/profitability/stock-loss', [ProfitabilityController::class, 'stockLoss']);
    Route::get('/profitability/branch-matrix', [ProfitabilityController::class, 'branchMatrix']);
});
