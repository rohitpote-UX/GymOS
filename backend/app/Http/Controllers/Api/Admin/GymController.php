<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\GymAsset;
use App\Models\Member;
use App\Models\Payment;
use App\Models\SaasOrder;
use App\Models\SaasPayment;
use App\Models\SaasPlan;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GymController extends Controller
{
    /**
     * Platform Overview for Super Admin with real KPIs & recent activity.
     */
    public function overview()
    {
        $now = now();
        $totalGyms = Gym::count();
        $activeGyms = Gym::where('status', Gym::STATUS_ACTIVE)
            ->where(function ($q) use ($now) {
                $q->whereNull('subscription_expires_at')
                  ->orWhere('subscription_expires_at', '>=', $now);
            })->count();

        $suspendedGyms = Gym::where('status', Gym::STATUS_SUSPENDED)->count();

        $expiredGyms = Gym::where(function ($q) use ($now) {
            $q->where('status', 'expired')
              ->orWhere(function ($sub) use ($now) {
                  $sub->whereNotNull('subscription_expires_at')
                      ->where('subscription_expires_at', '<', $now);
              });
        })->count();

        $pendingGyms = Gym::where('status', 'pending')->count();
        $trialGyms = Gym::where('status', Gym::STATUS_TRIAL)->count();

        $totalMembers = Member::withoutGlobalScope('gym')->count();
        $totalBranches = Branch::withoutGlobalScope('gym')->count();

        // Real Monthly Recurring Revenue (MRR) calculated from active gyms' plans
        $activeGymsWithPlan = Gym::where('status', Gym::STATUS_ACTIVE)
            ->where(function ($q) use ($now) {
                $q->whereNull('subscription_expires_at')
                  ->orWhere('subscription_expires_at', '>=', $now);
            })
            ->with('plan')
            ->get();

        $mrr = 0.0;
        foreach ($activeGymsWithPlan as $g) {
            if ($g->plan) {
                $planPrice = (float) $g->plan->price;
                $mrr += ($g->plan->interval === 'year') ? ($planPrice / 12) : $planPrice;
            }
        }

        $newRegistrations = Gym::where('created_at', '>=', now()->subDays(30))->count();
        $totalSaasRevenue = SaasOrder::where('status', 'paid')->sum('amount');

        // Recent Activity feeds
        $recentGyms = Gym::with(['plan', 'users' => function ($q) {
            $q->where('role', User::ROLE_GYM_OWNER);
        }])->withCount(['members', 'branches'])->latest()->take(6)->get();

        $recentPayments = SaasPayment::withoutGlobalScope('gym')
            ->with(['gym:id,name,slug', 'plan:id,name'])
            ->latest()
            ->take(6)
            ->get();

        $expiringSubscriptions = Gym::where('status', Gym::STATUS_ACTIVE)
            ->whereNotNull('subscription_expires_at')
            ->whereBetween('subscription_expires_at', [now(), now()->addDays(14)])
            ->with(['plan', 'users' => function ($q) {
                $q->where('role', User::ROLE_GYM_OWNER);
            }])
            ->orderBy('subscription_expires_at')
            ->take(6)
            ->get();

        $suspendedAccounts = Gym::where('status', Gym::STATUS_SUSPENDED)
            ->with(['plan'])
            ->latest('updated_at')
            ->take(6)
            ->get();

        $recentAdminActions = AuditLog::withoutGlobalScope('gym')
            ->with(['user:id,name,email', 'gym:id,name,slug'])
            ->where('event', 'like', 'admin.%')
            ->latest()
            ->take(8)
            ->get();

        return response()->json([
            'metrics' => [
                'total_gyms' => $totalGyms,
                'active_gyms' => $activeGyms,
                'suspended_gyms' => $suspendedGyms,
                'expired_subscriptions' => $expiredGyms,
                'pending_gyms' => $pendingGyms,
                'trial_gyms' => $trialGyms,
                'total_members' => $totalMembers,
                'total_branches' => $totalBranches,
                'mrr' => round($mrr, 2),
                'new_registrations' => $newRegistrations,
                'saas_revenue' => (float) $totalSaasRevenue,
            ],
            'recent_activity' => [
                'recent_gyms' => $recentGyms,
                'recent_payments' => $recentPayments,
                'expiring_subscriptions' => $expiringSubscriptions,
                'suspended_accounts' => $suspendedAccounts,
                'recent_admin_actions' => $recentAdminActions,
            ],
        ]);
    }

    /**
     * List all Gyms with card-oriented metadata, search, filters & sorting.
     */
    public function index(Request $request)
    {
        $now = now();
        $query = Gym::with([
            'plan',
            'branches',
            'users' => function ($q) {
                $q->where('role', User::ROLE_GYM_OWNER);
            },
            'assets' => function ($q) {
                $q->where('kind', 'logo');
            },
        ])->withCount(['branches', 'members', 'users']);

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $status = $request->input('status');
            if ($status === 'expired') {
                $query->where(function ($q) use ($now) {
                    $q->where('status', 'expired')
                      ->orWhere(function ($sub) use ($now) {
                          $sub->whereNotNull('subscription_expires_at')
                              ->where('subscription_expires_at', '<', $now);
                      });
                });
            } elseif ($status === 'active') {
                $query->where('status', Gym::STATUS_ACTIVE)
                      ->where(function ($q) use ($now) {
                          $q->whereNull('subscription_expires_at')
                            ->orWhere('subscription_expires_at', '>=', $now);
                      });
            } else {
                $query->where('status', $status);
            }
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('email', 'like', $search)
                  ->orWhere('phone', 'like', $search)
                  ->orWhere('slug', 'like', $search)
                  ->orWhereHas('users', function ($uq) use ($search) {
                      $uq->where('name', 'like', $search)
                         ->orWhere('email', 'like', $search)
                         ->orWhere('phone', 'like', $search);
                  });
            });
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');

        if ($sortBy === 'name') {
            $query->orderBy('name', $sortOrder);
        } elseif ($sortBy === 'subscription_expires_at') {
            $query->orderBy('subscription_expires_at', $sortOrder);
        } elseif ($sortBy === 'members_count') {
            $query->orderBy('members_count', $sortOrder);
        } else {
            $query->orderBy('created_at', $sortOrder);
        }

        $perPage = (int) $request->input('per_page', 12);
        $gyms = $query->paginate($perPage);

        return response()->json($gyms);
    }

    /**
     * Check URL slug availability and return suggestion if taken.
     */
    public function checkSlug(Request $request)
    {
        $raw = $request->input('slug', '');
        $slug = Str::slug($raw);

        if (empty($slug)) {
            return response()->json(['available' => false, 'slug' => '', 'message' => 'Slug cannot be empty.']);
        }

        $excludeId = $request->input('exclude_id');
        $query = Gym::where('slug', $slug);
        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        $exists = $query->exists();

        if ($exists) {
            $candidate = $slug . '-' . Str::lower(Str::random(3));
            return response()->json([
                'available' => false,
                'slug' => $slug,
                'suggested' => $candidate,
                'message' => 'Slug is already taken.',
            ]);
        }

        return response()->json([
            'available' => true,
            'slug' => $slug,
            'message' => 'Slug is available!',
        ]);
    }

    /**
     * Platform SaaS Subscription Payments Ledger.
     */
    public function payments(Request $request)
    {
        $query = SaasPayment::withoutGlobalScope('gym')
            ->with(['gym:id,name,slug,email,phone', 'plan:id,name,price,interval']);

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('razorpay_payment_id', 'like', $search)
                  ->orWhere('payment_method', 'like', $search)
                  ->orWhereHas('gym', function ($gq) use ($search) {
                      $gq->where('name', 'like', $search)
                         ->orWhere('slug', 'like', $search);
                  });
            });
        }

        $payments = $query->latest()->paginate(20);

        return response()->json($payments);
    }

    /**
     * Show single Gym details.
     */
    public function show(int $id)
    {
        $gym = Gym::with([
            'plan',
            'branches.staff',
            'users',
            'assets' => function ($q) {
                $q->where('kind', 'logo');
            },
        ])
        ->withCount(['members', 'branches'])
        ->findOrFail($id);

        $owner = $gym->users()->where('role', User::ROLE_GYM_OWNER)->first();
        $revenue = Payment::withoutGlobalScope('gym')->where('gym_id', $gym->id)->sum('amount');

        return response()->json([
            'gym' => $gym,
            'owner' => $owner,
            'metrics' => [
                'total_revenue' => (float) $revenue,
                'is_expired' => $gym->isExpired(),
            ],
        ]);
    }

    /**
     * Suspend a Gym.
     */
    public function suspend(int $id, Request $request)
    {
        $gym = Gym::findOrFail($id);
        $gym->update(['status' => Gym::STATUS_SUSPENDED]);

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.gym_suspended',
            'ip_address' => $request->ip(),
            'payload' => ['reason' => $request->input('reason', 'Administrative suspension')],
        ]);

        return response()->json(['message' => "Gym '{$gym->name}' suspended successfully.", 'gym' => $gym]);
    }

    /**
     * Activate a Gym.
     */
    public function activate(int $id, Request $request)
    {
        $gym = Gym::findOrFail($id);
        $gym->update(['status' => Gym::STATUS_ACTIVE]);

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.gym_activated',
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => "Gym '{$gym->name}' activated successfully.", 'gym' => $gym]);
    }

    /**
     * Extend Gym Subscription Period manually.
     */
    public function extendSubscription(int $id, Request $request)
    {
        $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:3650'],
        ]);

        $gym = Gym::findOrFail($id);
        $days = (int) $request->input('days');

        $baseDate = ($gym->subscription_expires_at && $gym->subscription_expires_at->isFuture())
            ? $gym->subscription_expires_at
            : now();

        $newExpiresAt = $baseDate->copy()->addDays($days);
        $gym->update([
            'status' => Gym::STATUS_ACTIVE,
            'subscription_expires_at' => $newExpiresAt,
        ]);

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.subscription_extended',
            'ip_address' => $request->ip(),
            'payload' => ['days' => $days, 'new_expires_at' => $newExpiresAt->toIso8601String()],
        ]);

        return response()->json([
            'message' => "Subscription extended by {$days} days.",
            'subscription_expires_at' => $newExpiresAt->toIso8601String(),
        ]);
    }

    /**
     * Super Admin module override for individual Gym.
     */
    public function updateModules(int $id, Request $request)
    {
        $gym = Gym::findOrFail($id);

        $validated = $request->validate([
            'modules' => ['nullable', 'array'],
            'modules.*' => ['string'],
        ]);

        $gym->modules = $validated['modules'];
        $gym->save();
        \App\Support\CurrentGym::clear();

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.gym_modules_updated',
            'ip_address' => $request->ip(),
            'payload' => ['modules' => $gym->modules],
        ]);

        return response()->json([
            'message' => "Modules updated for gym '{$gym->name}'.",
            'gym' => $gym->fresh(),
            'active_modules' => $gym->getActiveModules(),
        ]);
    }

    /**
     * Impersonate a Gym Owner for customer support.
     */
    public function impersonate(int $id, Request $request)
    {
        $gym = Gym::findOrFail($id);
        $owner = $gym->users()->where('role', User::ROLE_GYM_OWNER)->firstOrFail();

        // 2-hour impersonation session
        $token = $owner->createToken('impersonate:' . $request->user()->id, ['*'], now()->addHours(2))->plainTextToken;

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.impersonated_owner',
            'ip_address' => $request->ip(),
            'payload' => ['target_user_id' => $owner->id, 'owner_email' => $owner->email],
        ]);

        return response()->json([
            'token' => $token,
            'user' => AuthController::presentUser($owner, true),
        ]);
    }

    /**
     * Platform Audit Logs.
     */
    public function auditLog()
    {
        $logs = AuditLog::withoutGlobalScope('gym')
            ->with(['user:id,name,email', 'branch:id,name', 'gym:id,name,slug'])
            ->latest()
            ->paginate(30);

        return response()->json($logs);
    }

    /**
     * Register a new Gym with complete Section A (Info), Section B (Owner), Section C (Subscription & Payment).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            // Section A: Gym Info
            'name' => ['required', 'string', 'max:120'],
            'name_mr' => ['nullable', 'string', 'max:150'],
            'name_hi' => ['nullable', 'string', 'max:150'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'slug' => ['nullable', 'string', 'max:80', 'unique:gyms,slug'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150', 'unique:gyms,email'],
            'address' => ['nullable', 'string', 'max:250'],
            'city' => ['nullable', 'string', 'max:80'],
            'default_language' => ['nullable', 'in:en,mr,hi'],
            'logo' => ['nullable', 'string'],

            // Section B: Owner Account
            'owner_name' => ['required', 'string', 'max:100'],
            'owner_phone' => ['nullable', 'string', 'max:30'],
            'owner_email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'owner_password' => ['required', 'string', 'min:8'],

            // Section C: Subscription
            'saas_plan_id' => ['required', 'exists:saas_plans,id'],
            'payment_option' => ['nullable', 'in:pending,paid'],
            'payment_reference' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'period_months' => ['nullable', 'integer', 'min:1'],
        ]);

        $plan = SaasPlan::findOrFail($validated['saas_plan_id']);

        $gym = DB::transaction(function () use ($validated, $plan, $request) {
            $slug = !empty($validated['slug'])
                ? Str::slug($validated['slug'])
                : Str::slug($validated['name']);

            if (Gym::where('slug', $slug)->exists()) {
                $slug .= '-' . Str::lower(Str::random(4));
            }

            $isPaid = ($validated['payment_option'] ?? 'paid') === 'paid';
            $durationMonths = $validated['period_months'] ?? ($plan->interval === 'year' ? 12 : 1);
            $expiresAt = $isPaid ? now()->addMonths($durationMonths) : null;
            $status = $isPaid ? Gym::STATUS_ACTIVE : 'pending';

            $settings = [
                'default_language' => $validated['default_language'] ?? 'en',
                'name_mr' => $validated['name_mr'] ?? null,
                'name_hi' => $validated['name_hi'] ?? null,
                'short_name' => $validated['short_name'] ?? null,
            ];

            $gym = Gym::create([
                'name' => $validated['name'],
                'legal_name' => $validated['short_name'] ?? $validated['name'],
                'slug' => $slug,
                'email' => $validated['email'] ?? null,
                'phone' => $validated['phone'],
                'status' => $status,
                'saas_plan_id' => $plan->id,
                'subscription_expires_at' => $expiresAt,
                'billing_cycle' => $plan->interval === 'year' ? 'yearly' : 'monthly',
                'settings' => $settings,
                'branding' => [
                    'name_mr' => $validated['name_mr'] ?? null,
                    'name_hi' => $validated['name_hi'] ?? null,
                    'short_name' => $validated['short_name'] ?? null,
                ],
            ]);

            // Save Logo in gym_assets if provided
            if (!empty($validated['logo'])) {
                GymAsset::updateOrCreate(
                    ['gym_id' => $gym->id, 'kind' => 'logo'],
                    ['mime' => 'image/png', 'data' => $validated['logo']]
                );
            }

            // Create Primary Branch
            $branch = Branch::create([
                'gym_id' => $gym->id,
                'name' => $validated['name'] . ' Main Club',
                'code' => 'MAIN',
                'phone' => $validated['phone'],
                'email' => $validated['email'] ?? null,
                'address' => $validated['address'] ?? null,
                'city' => $validated['city'] ?? 'Mumbai',
                'is_primary' => true,
                'is_active' => true,
            ]);

            $ownerPhone = $validated['owner_phone'] ?? $validated['phone'];

            // Create Owner Account
            $owner = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branch->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $ownerPhone,
                'password' => bcrypt($validated['owner_password']),
                'role' => User::ROLE_GYM_OWNER,
                'preferred_language' => $validated['default_language'] ?? 'en',
                'is_active' => true,
            ]);

            // If Payment Done, record Order & Payment
            if ($isPaid) {
                $ref = !empty($validated['payment_reference']) ? $validated['payment_reference'] : ('MANUAL-' . strtoupper(Str::random(10)));
                $method = $validated['payment_method'] ?? 'bank_transfer';
                $order = SaasOrder::create([
                    'gym_id' => $gym->id,
                    'saas_plan_id' => $plan->id,
                    'razorpay_order_id' => 'order_' . Str::random(16),
                    'amount' => $plan->price,
                    'currency' => 'INR',
                    'interval' => $plan->interval,
                    'status' => 'paid',
                    'receipt' => $ref,
                    'meta' => [
                        'admin_registered' => true,
                        'reference' => $ref,
                        'method' => $method,
                    ],
                ]);

                SaasPayment::create([
                    'gym_id' => $gym->id,
                    'saas_order_id' => $order->id,
                    'saas_plan_id' => $plan->id,
                    'razorpay_payment_id' => 'pay_' . Str::random(16),
                    'razorpay_order_id' => $order->razorpay_order_id,
                    'amount' => $plan->price,
                    'currency' => 'INR',
                    'payment_method' => $method,
                    'period_start' => now(),
                    'period_end' => $expiresAt,
                    'payload' => [
                        'reference' => $ref,
                        'verified_by_admin' => $request->user()->name,
                    ],
                ]);
            } else {
                // Pending Order
                SaasOrder::create([
                    'gym_id' => $gym->id,
                    'saas_plan_id' => $plan->id,
                    'razorpay_order_id' => 'order_' . Str::random(16),
                    'amount' => $plan->price,
                    'currency' => 'INR',
                    'interval' => $plan->interval,
                    'status' => 'created',
                    'receipt' => 'PENDING-' . strtoupper(Str::random(8)),
                    'meta' => ['admin_registered' => true, 'payment_status' => 'pending'],
                ]);
            }

            AuditLog::withoutGlobalScope('gym')->create([
                'gym_id' => $gym->id,
                'user_id' => $request->user()->id,
                'event' => 'admin.gym_registered',
                'ip_address' => $request->ip(),
                'payload' => [
                    'gym_id' => $gym->id,
                    'owner_id' => $owner->id,
                    'plan_id' => $plan->id,
                    'payment_option' => $validated['payment_option'] ?? 'paid',
                ],
            ]);

            return $gym->load(['plan', 'branches', 'assets']);
        });

        return response()->json([
            'message' => "Gym '{$gym->name}' registered successfully.",
            'gym' => $gym,
        ], 201);
    }

    /**
     * Edit Gym configuration.
     */
    public function update(int $id, Request $request)
    {
        $gym = Gym::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:150', "unique:gyms,email,{$gym->id}"],
            'phone' => ['sometimes', 'string', 'max:30'],
            'saas_plan_id' => ['sometimes', 'exists:saas_plans,id'],
            'status' => ['sometimes', 'in:active,suspended,trial,pending'],
        ]);

        $gym->update($validated);

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.gym_updated',
            'ip_address' => $request->ip(),
            'payload' => $validated,
        ]);

        return response()->json([
            'message' => "Gym '{$gym->name}' updated successfully.",
            'gym' => $gym->fresh(['plan', 'branches']),
        ]);
    }

    /**
     * Securely reset Gym Owner password.
     */
    public function resetOwnerPassword(int $id, Request $request)
    {
        $request->validate([
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $gym = Gym::findOrFail($id);
        $owner = $gym->users()->where('role', User::ROLE_GYM_OWNER)->firstOrFail();

        $plainPassword = $request->input('password') ?: Str::password(12);
        $owner->update([
            'password' => bcrypt($plainPassword),
        ]);

        // Revoke all existing sessions for security
        $owner->tokens()->delete();

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $gym->id,
            'user_id' => $request->user()->id,
            'event' => 'admin.owner_password_reset',
            'ip_address' => $request->ip(),
            'payload' => ['target_user_id' => $owner->id, 'owner_email' => $owner->email],
        ]);

        return response()->json([
            'message' => "Password reset successfully for owner '{$owner->email}'. Existing login sessions revoked.",
            'owner_email' => $owner->email,
            'temporary_password' => $plainPassword,
        ]);
    }

    /**
     * View Platform-wide Support Tickets (scope: saas_platform).
     */
    public function supportTickets(Request $request)
    {
        $query = SupportTicket::withoutGlobalScope('gym')
            ->with(['gym:id,name,slug', 'creator:id,name,email,role', 'messages.user:id,name,role'])
            ->where('scope', 'saas_platform');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->input('priority'));
        }

        $tickets = $query->latest()->paginate(25);

        return response()->json($tickets);
    }

    /**
     * Reply to a Platform Support Ticket as Super Admin.
     */
    public function replySupportTicket(int $id, Request $request)
    {
        $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'status' => ['nullable', 'in:open,in_progress,resolved,closed'],
        ]);

        $ticket = SupportTicket::withoutGlobalScope('gym')
            ->where('scope', 'saas_platform')
            ->findOrFail($id);

        $msg = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'message' => $request->input('message'),
        ]);

        if ($request->filled('status')) {
            $ticket->update(['status' => $request->input('status')]);
        }

        AuditLog::withoutGlobalScope('gym')->create([
            'gym_id' => $ticket->gym_id,
            'user_id' => $request->user()->id,
            'event' => 'admin.ticket_replied',
            'ip_address' => $request->ip(),
            'payload' => ['ticket_id' => $ticket->id, 'ticket_number' => $ticket->ticket_number],
        ]);

        return response()->json([
            'message' => 'Reply posted successfully.',
            'ticket_message' => $msg->load('user:id,name,role'),
            'ticket' => $ticket->fresh(['gym:id,name', 'messages.user:id,name,role']),
        ]);
    }

    /**
     * Update Support Ticket Status.
     */
    public function updateTicketStatus(int $id, Request $request)
    {
        $request->validate([
            'status' => ['required', 'in:open,in_progress,resolved,closed'],
        ]);

        $ticket = SupportTicket::withoutGlobalScope('gym')
            ->where('scope', 'saas_platform')
            ->findOrFail($id);

        $ticket->update([
            'status' => $request->input('status'),
            'resolved_at' => in_array($request->input('status'), ['resolved', 'closed']) ? now() : null,
        ]);

        return response()->json([
            'message' => "Ticket '{$ticket->ticket_number}' status updated to {$ticket->status}.",
            'ticket' => $ticket,
        ]);
    }
}
