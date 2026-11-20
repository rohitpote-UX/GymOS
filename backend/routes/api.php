<?php

use App\Http\Controllers\Api\ActionCenterController;
use App\Http\Controllers\Api\Admin\GymController as AdminGymController;
use App\Http\Controllers\Api\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Api\AiAdvisorController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\BrandingController;
use App\Http\Controllers\Api\CashClosingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\GlobalSearchController;
use App\Http\Controllers\Api\GymQrCodeController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\MemberMembershipController;
use App\Http\Controllers\Api\MemberPortalController;
use App\Http\Controllers\Api\MembershipPlanController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfitabilityController;
use App\Http\Controllers\Api\PurchaseInvoiceController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SelfCheckInController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\TrainerController;
use App\Http\Controllers\Api\TrainerPortalController;
use App\Http\Controllers\Api\WhatsAppController;
use Illuminate\Support\Facades\Route;

// -------------------------------------------------------------
// 1. PUBLIC ROUTES
// -------------------------------------------------------------
Route::post('/register', [AuthController::class, 'registerGym'])->middleware('throttle:15,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/billing/webhook', [BillingController::class, 'webhook']);
Route::match(['get', 'post'], '/whatsapp/webhook', [WhatsAppController::class, 'webhook']);

// Public branding & PWA manifest endpoints
Route::get('/branding', [BrandingController::class, 'platform']);
Route::get('/manifest.webmanifest', [BrandingController::class, 'platformManifest']);
Route::get('/gyms/{slug}/branding', [BrandingController::class, 'gym']);
Route::get('/gyms/{slug}/manifest.webmanifest', [BrandingController::class, 'gymManifest']);
Route::get('/gyms/{slug}/icons/{kind}.png', [BrandingController::class, 'icon']);

// Member Self Check-in via QR Poster (Public / Rate-limited)
Route::prefix('self-check-in')->middleware('throttle:60,1')->group(function () {
    Route::get('/info/{token}', [SelfCheckInController::class, 'info']);
    Route::post('/verify-member', [SelfCheckInController::class, 'verifyMember'])->middleware('throttle:30,1');
    Route::post('/confirm', [SelfCheckInController::class, 'confirm'])->middleware('throttle:20,1');
});

// -------------------------------------------------------------
// 2. AUTHENTICATED COMMON ROUTES
// -------------------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/me/password', [AuthController::class, 'changePassword']);
    Route::put('/me/language', [AuthController::class, 'updateLanguage']);
});

// -------------------------------------------------------------
// 3. SUPER ADMIN PLATFORM MANAGEMENT
// -------------------------------------------------------------
Route::middleware(['auth:sanctum', 'super.admin'])->prefix('admin')->group(function () {
    Route::get('/overview', [AdminGymController::class, 'overview']);
    Route::get('/gyms', [AdminGymController::class, 'index']);
    Route::post('/gyms', [AdminGymController::class, 'store']);
    Route::get('/gyms/{id}', [AdminGymController::class, 'show']);
    Route::put('/gyms/{id}', [AdminGymController::class, 'update']);
    Route::put('/gyms/{id}/modules', [AdminGymController::class, 'updateModules']);
    Route::post('/gyms/{id}/suspend', [AdminGymController::class, 'suspend']);
    Route::post('/gyms/{id}/activate', [AdminGymController::class, 'activate']);
    Route::post('/gyms/{id}/extend-subscription', [AdminGymController::class, 'extendSubscription']);
    Route::post('/gyms/{id}/reset-owner-password', [AdminGymController::class, 'resetOwnerPassword']);
    Route::post('/gyms/{id}/impersonate', [AdminGymController::class, 'impersonate']);
    Route::get('/audit', [AdminGymController::class, 'auditLog']);

    // Platform Support Tickets
    Route::get('/support-tickets', [AdminGymController::class, 'supportTickets']);
    Route::post('/support-tickets/{id}/reply', [AdminGymController::class, 'replySupportTicket']);
    Route::put('/support-tickets/{id}/status', [AdminGymController::class, 'updateTicketStatus']);

    Route::apiResource('plans', AdminPlanController::class);
});

// -------------------------------------------------------------
// 4. TENANT GYM BUSINESS OS ROUTES (Scoped to CurrentGym & CurrentBranch)
// -------------------------------------------------------------
Route::middleware(['auth:sanctum', 'gym', 'branch'])->group(function () {
    // Executive Dashboard & Overview (Core)
    Route::get('/dashboard', DashboardController::class);
    Route::get('/owner-dashboard', OwnerDashboardController::class);
    Route::get('/action-center', [ActionCenterController::class, 'index']);
    Route::post('/action-center', [ActionCenterController::class, 'store']);
    Route::post('/action-center/{id}/assign', [ActionCenterController::class, 'assign']);
    Route::post('/action-center/{id}/resolve', [ActionCenterController::class, 'resolve']);

    // Global Search API
    Route::get('/search', [GlobalSearchController::class, 'search']);

    // User & Staff Management (Core)
    Route::apiResource('staff', StaffController::class);

    // Module 1: Member Management (Core)
    Route::apiResource('members', MemberController::class);
    Route::post('/members/{id}/photo', [MemberController::class, 'updatePhoto']);
    Route::get('/members/{id}/qr-code', [MemberController::class, 'qrCode']);

    // Module 2: Membership Plans & Subscriptions Lifecycle (Core)
    Route::apiResource('membership-plans', MembershipPlanController::class);
    Route::post('/member-memberships/renew', [MemberMembershipController::class, 'renew']);
    Route::post('/member-memberships/{id}/freeze', [MemberMembershipController::class, 'freeze']);
    Route::post('/member-memberships/{id}/unfreeze', [MemberMembershipController::class, 'unfreeze']);
    Route::post('/member-memberships/{id}/extend', [MemberMembershipController::class, 'extend']);
    Route::post('/member-memberships/{id}/cancel', [MemberMembershipController::class, 'cancel']);

    // Module 3: Attendance & Access Control
    Route::middleware('module:attendance')->group(function () {
        Route::get('/attendance', [AttendanceController::class, 'index']);
        Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
        Route::post('/attendance/qr-check-in', [AttendanceController::class, 'qrCheckIn']);
        Route::post('/attendance/{id}/check-out', [AttendanceController::class, 'checkOut']);
        Route::get('/attendance/today-stats', [AttendanceController::class, 'todayStats']);

        // Gym Self-Attendance QR Posters Management
        Route::get('/attendance/qr-codes', [GymQrCodeController::class, 'index']);
        Route::post('/attendance/qr-codes', [GymQrCodeController::class, 'store']);
        Route::get('/attendance/qr-codes/{id}', [GymQrCodeController::class, 'show']);
        Route::put('/attendance/qr-codes/{id}', [GymQrCodeController::class, 'update']);
        Route::post('/attendance/qr-codes/{id}/regenerate', [GymQrCodeController::class, 'regenerate']);
        Route::post('/attendance/qr-codes/{id}/toggle-status', [GymQrCodeController::class, 'toggleStatus']);
        Route::get('/attendance/qr-codes/{id}/activity', [GymQrCodeController::class, 'activity']);
    });

    // Module 4: Financial Management & Cash Flow
    Route::middleware('module:finance')->group(function () {
        Route::apiResource('payments', PaymentController::class)->only(['index', 'store', 'show']);
        Route::post('/payments/{id}/refund', [PaymentController::class, 'refund']);

        Route::get('/cash-closings/current', [CashClosingController::class, 'current']);
        Route::post('/cash-closings/close', [CashClosingController::class, 'close']);
        Route::get('/cash-closings/history', [CashClosingController::class, 'history']);

        Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
        Route::apiResource('expenses', ExpenseController::class);

        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/monthly', [ReportController::class, 'monthly']);
        Route::get('/reports/memberships', [ReportController::class, 'memberships']);
        Route::get('/reports/attendance', [ReportController::class, 'attendance']);
        Route::get('/reports/dues', [ReportController::class, 'dues']);
        Route::get('/reports/expenses', [ReportController::class, 'expenses']);
        Route::get('/reports/branch-revenue', [ReportController::class, 'branchRevenue']);
        Route::get('/reports/export/{type}', [ReportController::class, 'exportCsv']);
    });

    // Multi-Branch Management
    Route::apiResource('branches', BranchController::class);

    // Module 6: Staff, Trainers & PT
    Route::middleware('module:pt_trainers')->group(function () {
        Route::get('/trainers', [TrainerController::class, 'index']);
        Route::post('/trainers/{id}/assign-member', [TrainerController::class, 'assignMember']);
        Route::get('/pt-sessions', [TrainerController::class, 'sessions']);
        Route::post('/pt-sessions', [TrainerController::class, 'scheduleSession']);
        Route::post('/pt-sessions/{id}/complete', [TrainerController::class, 'completeSession']);
        Route::get('/staff-leaves', [TrainerController::class, 'leaves']);
        Route::post('/staff-leaves', [TrainerController::class, 'requestLeave']);
        Route::post('/staff-leaves/{id}/review', [TrainerController::class, 'reviewLeave']);
        Route::get('/trainers/performance-report', [TrainerController::class, 'performanceReport']);

        Route::get('/trainer-portal/dashboard', [TrainerPortalController::class, 'dashboard']);
        Route::get('/trainer-portal/members', [TrainerPortalController::class, 'members']);
        Route::get('/trainer-portal/sessions', [TrainerPortalController::class, 'sessions']);
        Route::post('/trainer-portal/sessions/{id}/complete', [TrainerPortalController::class, 'completeSession']);
        Route::post('/trainer-portal/assign-workout', [TrainerPortalController::class, 'assignWorkout']);
        Route::post('/trainer-portal/log-progress', [TrainerPortalController::class, 'logProgress']);
    });

    // Module 7: Leads & CRM
    Route::middleware('module:leads_crm')->group(function () {
        Route::get('/leads/stats', [LeadController::class, 'stats']);
        Route::apiResource('leads', LeadController::class);
        Route::post('/leads/{id}/follow-up', [LeadController::class, 'addFollowup']);
        Route::post('/leads/{id}/book-trial', [LeadController::class, 'bookTrial']);
        Route::post('/leads/{id}/convert', [LeadController::class, 'convert']);
        Route::post('/leads/{id}/mark-lost', [LeadController::class, 'markLost']);
    });

    // Inventory, Retail POS & Profitability
    Route::middleware('module:pos_inventory')->group(function () {
        Route::get('/products/categories', [ProductController::class, 'categories']);
        Route::get('/products/barcode/{code}', [ProductController::class, 'barcodeLookup']);
        Route::apiResource('products', ProductController::class);

        Route::get('/inventory/movements', [InventoryController::class, 'movements']);
        Route::post('/inventory/adjust', [InventoryController::class, 'adjustStock']);
        Route::get('/inventory/low-stock', [InventoryController::class, 'lowStockAlerts']);
        Route::get('/inventory/expiring', [InventoryController::class, 'expiringAlerts']);
        Route::post('/inventory/transfers', [InventoryController::class, 'transferStock']);

        Route::get('/suppliers/{id}/ledger', [SupplierController::class, 'ledger']);
        Route::post('/suppliers/{id}/payments', [SupplierController::class, 'recordPayment']);
        Route::apiResource('suppliers', SupplierController::class);

        Route::apiResource('purchase-invoices', PurchaseInvoiceController::class)->only(['index', 'store', 'show']);

        Route::post('/pos/checkout', [PosController::class, 'checkout']);
        Route::get('/pos/orders', [PosController::class, 'orders']);
        Route::get('/pos/orders/{id}', [PosController::class, 'show']);
        Route::post('/pos/orders/{id}/refund', [PosController::class, 'refund']);

        Route::get('/profitability/overview', [ProfitabilityController::class, 'overview']);
        Route::get('/profitability/product-performance', [ProfitabilityController::class, 'productPerformance']);
        Route::get('/profitability/slow-moving', [ProfitabilityController::class, 'slowMoving']);
        Route::get('/profitability/stock-loss', [ProfitabilityController::class, 'stockLoss']);
        Route::get('/profitability/branch-matrix', [ProfitabilityController::class, 'branchMatrix']);
    });

    // Module: WhatsApp Business Automation
    Route::middleware('module:whatsapp')->group(function () {
        Route::get('/whatsapp/templates', [WhatsAppController::class, 'templates']);
        Route::put('/whatsapp/templates/{id}', [WhatsAppController::class, 'updateTemplate']);
        Route::get('/whatsapp/logs', [WhatsAppController::class, 'logs']);
        Route::post('/whatsapp/send', [WhatsAppController::class, 'send']);
    });

    // Module: AI Gym Business Advisor
    Route::middleware('module:ai_advisor')->group(function () {
        Route::get('/ai-advisor/insights', [AiAdvisorController::class, 'insights']);
        Route::post('/ai-advisor/ask', [AiAdvisorController::class, 'ask']);
    });

    // Member Experience Portal (Core)
    Route::get('/member-portal/profile', [MemberPortalController::class, 'profile']);
    Route::get('/member-portal/attendance', [MemberPortalController::class, 'attendance']);
    Route::get('/member-portal/payments', [MemberPortalController::class, 'payments']);
    Route::get('/member-portal/workouts', [MemberPortalController::class, 'workouts']);
    Route::get('/member-portal/pt-sessions', [MemberPortalController::class, 'ptSessions']);
    Route::get('/member-portal/progress', [MemberPortalController::class, 'progress']);
    Route::post('/member-portal/renew-request', [MemberPortalController::class, 'renewRequest']);
    Route::put('/member-portal/profile', [MemberPortalController::class, 'updateProfile']);

    // Support Desk (Core)
    Route::apiResource('support-tickets', SupportTicketController::class);
    Route::post('/support-tickets/{id}/messages', [SupportTicketController::class, 'addMessage']);
    Route::put('/support-tickets/{id}/status', [SupportTicketController::class, 'updateStatus']);

    // SaaS Subscription Billing
    Route::get('/billing', [BillingController::class, 'index'])->name('billing.index');
    Route::post('/billing/order', [BillingController::class, 'order'])->name('billing.order');
    Route::post('/billing/verify', [BillingController::class, 'verify'])->name('billing.verify');

    // Gym Settings, Dynamic Branding & Module Activation
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::get('/settings/modules', [SettingsController::class, 'modules']);
    Route::put('/settings/modules', [SettingsController::class, 'updateModules']);
    Route::post('/settings/logo', [SettingsController::class, 'uploadLogo']);
    Route::delete('/settings/logo', [SettingsController::class, 'removeLogo']);

    // Tenant Audit Trail
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
});
