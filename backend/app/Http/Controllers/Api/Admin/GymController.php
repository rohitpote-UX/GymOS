<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\Member;
use App\Models\Payment;
use App\Models\SaasOrder;
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
     * Platform Overview for Super Admin.
     */
    public function overview()
    {
        $totalGyms = Gym::count();
        $activeGyms = Gym::where('status', Gym::STATUS_ACTIVE)->count();
        $trialGyms = Gym::where('status', Gym::STATUS_TRIAL)->count();
        $suspendedGyms = Gym::where('status', Gym::STATUS_SUSPENDED)->count();

        $totalMembers = Member::withoutGlobalScope('gym')->count();
        $totalBranches = Branch::withoutGlobalScope('gym')->count();
        $totalSaasRevenue = SaasOrder::where('status', 'paid')->sum('amount');

        $recentGyms = Gym::with('plan')->latest()->take(5)->get();

        return response()->json([
            'metrics' => [
                'total_gyms' => $totalGyms,
                'active_gyms' => $activeGyms,
                'trial_gyms' => $trialGyms,
                'suspended_gyms' => $suspendedGyms,
                'total_members' => $totalMembers,
                'total_branches' => $totalBranches,
                'saas_revenue' => (float) $totalSaasRevenue,
            ],
            'recent_gyms' => $recentGyms,
        ]);
    }

    /**
     * List all Gyms with filters.
     */
    public function index(Request $request)
    {
        $query = Gym::with(['plan', 'branches'])
            ->withCount(['branches', 'members', 'users']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('email', 'like', $search)
                  ->orWhere('phone', 'like', $search)
                  ->orWhere('slug', 'like', $search);
            });
        }

        $gyms = $query->latest()->paginate(15);

        return response()->json($gyms);
    }

    /**
     * Show single Gym details.
     */
    public function show(int $id)
    {
        $gym = Gym::with(['plan', 'branches.staff', 'users'])
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
            ->with(['user:id,name,email', 'branch:id,name'])
            ->latest()
            ->paginate(30);

        return response()->json($logs);
    }

    /**
     * Register a new Gym from Super Admin console.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:80', 'unique:gyms,slug'],
            'email' => ['required', 'email', 'max:150', 'unique:gyms,email'],
            'phone' => ['required', 'string', 'max:30'],
            'saas_plan_id' => ['required', 'exists:saas_plans,id'],
            'owner_name' => ['required', 'string', 'max:100'],
            'owner_email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'owner_password' => ['required', 'string', 'min:8'],
            'branch_name' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:60'],
        ]);

        $plan = SaasPlan::findOrFail($validated['saas_plan_id']);

        $gym = DB::transaction(function () use ($validated, $plan, $request) {
            $slug = !empty($validated['slug'])
                ? Str::slug($validated['slug'])
                : Str::slug($validated['name']);

            if (Gym::where('slug', $slug)->exists()) {
                $slug .= '-' . Str::lower(Str::random(4));
            }

            $gym = Gym::create([
                'name' => $validated['name'],
                'slug' => $slug,
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'status' => Gym::STATUS_ACTIVE,
                'saas_plan_id' => $plan->id,
                'subscription_expires_at' => now()->addDays($plan->interval === 'year' ? 365 : 30),
            ]);

            $branch = Branch::create([
                'gym_id' => $gym->id,
                'name' => $validated['branch_name'] ?? ($gym->name . ' Main Club'),
                'code' => 'MAIN',
                'city' => $validated['city'] ?? 'Mumbai',
                'phone' => $validated['phone'],
                'is_main' => true,
                'is_active' => true,
            ]);

            $owner = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branch->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $validated['phone'],
                'password' => bcrypt($validated['owner_password']),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);

            AuditLog::withoutGlobalScope('gym')->create([
                'gym_id' => $gym->id,
                'user_id' => $request->user()->id,
                'event' => 'admin.gym_registered',
                'ip_address' => $request->ip(),
                'payload' => ['gym_id' => $gym->id, 'owner_id' => $owner->id],
            ]);

            return $gym->load(['plan', 'branches']);
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
            'status' => ['sometimes', 'in:active,suspended,trial'],
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
