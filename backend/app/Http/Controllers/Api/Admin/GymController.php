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
}
