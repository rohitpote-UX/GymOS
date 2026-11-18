<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\AttendanceLog;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\MemberProgressLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\PtSession;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MemberPortalController extends Controller
{
    /**
     * Resolve the current member from the request.
     * Can be authenticated member user, or requested by member ID for preview.
     */
    protected function resolveMember(Request $request): Member
    {
        $user = $request->user();

        // If member user
        if ($user && $user->role === 'member') {
            $member = Member::where('gym_id', $user->gym_id)
                ->where(function ($q) use ($user) {
                    $q->where('phone', $user->phone)->orWhere('email', $user->email);
                })
                ->first();

            if ($member) {
                return $member;
            }
        }

        // Staff preview / specific member lookup
        $memberId = $request->query('member_id') ?: $request->input('member_id');
        if ($memberId) {
            return Member::where('gym_id', CurrentGym::require())->findOrFail($memberId);
        }

        // Fallback to first member in gym
        return Member::where('gym_id', CurrentGym::require())->firstOrFail();
    }

    public function profile(Request $request)
    {
        $member = $this->resolveMember($request);
        $member->load([
            'primaryBranch:id,name,code,address',
            'trainer:id,name,phone,specialization,avatar_url',
            'activeMembership.plan',
        ]);

        $activeSub = $member->activeMembership;
        $daysRemaining = 0;
        $isExpiringSoon = false;

        if ($activeSub) {
            $endDate = Carbon::parse($activeSub->end_date);
            $today = Carbon::today();
            $daysRemaining = max(0, $today->diffInDays($endDate, false));
            $isExpiringSoon = $daysRemaining <= 7 && $daysRemaining >= 0;
        }

        return response()->json([
            'member' => $member,
            'card' => [
                'member_code' => $member->member_code,
                'full_name' => $member->full_name,
                'status' => $member->status,
                'joined_date' => $member->joined_date?->toDateString(),
                'branch_name' => $member->primaryBranch?->name,
                'plan_name' => $activeSub?->plan?->name ?? 'No Active Plan',
                'start_date' => $activeSub?->start_date,
                'end_date' => $activeSub?->end_date,
                'days_remaining' => (int) $daysRemaining,
                'is_expiring_soon' => $isExpiringSoon,
                'outstanding_balance' => (float) $member->outstanding_balance,
            ],
        ]);
    }

    public function attendance(Request $request)
    {
        $member = $this->resolveMember($request);

        $logs = AttendanceLog::with('branch:id,name')
            ->where('member_id', $member->id)
            ->latest('check_in_at')
            ->take(30)
            ->get();

        // Calculate workout streak
        $thisMonthCheckins = AttendanceLog::where('member_id', $member->id)
            ->whereBetween('check_in_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        return response()->json([
            'streak_this_month' => $thisMonthCheckins,
            'attendance' => $logs,
        ]);
    }

    public function payments(Request $request)
    {
        $member = $this->resolveMember($request);

        $payments = Payment::with('branch:id,name')
            ->where('member_id', $member->id)
            ->where('status', 'completed')
            ->latest('payment_date')
            ->take(20)
            ->get();

        $posOrders = PosOrder::with('items.product')
            ->where('member_id', $member->id)
            ->latest('order_date')
            ->take(20)
            ->get();

        return response()->json([
            'total_billed' => (float) $member->total_fees_billed,
            'total_paid' => (float) $member->total_fees_paid,
            'outstanding_balance' => (float) $member->outstanding_balance,
            'membership_payments' => $payments,
            'supplement_orders' => $posOrders,
        ]);
    }

    public function workouts(Request $request)
    {
        $member = $this->resolveMember($request);

        $workouts = MemberWorkoutPlan::with('trainer:id,name,phone')
            ->where('member_id', $member->id)
            ->latest('start_date')
            ->get();

        return response()->json([
            'workouts' => $workouts,
        ]);
    }

    public function ptSessions(Request $request)
    {
        $member = $this->resolveMember($request);

        $sessions = PtSession::with('trainer:id,name,phone,specialization')
            ->where('member_id', $member->id)
            ->latest('scheduled_at')
            ->take(20)
            ->get();

        return response()->json([
            'sessions' => $sessions,
        ]);
    }

    public function progress(Request $request)
    {
        $member = $this->resolveMember($request);

        $progressLogs = MemberProgressLog::where('member_id', $member->id)
            ->latest('log_date')
            ->take(15)
            ->get();

        return response()->json([
            'logs' => $progressLogs,
        ]);
    }

    public function renewRequest(Request $request)
    {
        $member = $this->resolveMember($request);

        $validated = $request->validate([
            'membership_plan_id' => 'required|exists:membership_plans,id',
            'notes' => 'nullable|string|max:255',
        ]);

        $plan = MembershipPlan::findOrFail($validated['membership_plan_id']);

        // Log an Action Item for reception staff to follow up and process renewal
        ActionItem::create([
            'gym_id' => $member->gym_id,
            'branch_id' => $member->primary_branch_id,
            'type' => 'expiring_membership',
            'severity' => 'warning',
            'title' => "Online Renewal Request: {$member->full_name} ({$plan->name})",
            'description' => "Member {$member->full_name} requested renewal for {$plan->name} (₹{$plan->price}). Phone: {$member->phone}.",
            'reference_type' => 'member',
            'reference_id' => $member->id,
            'status' => 'pending',
            'due_date' => now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Renewal request submitted successfully! Reception staff will contact you or confirm payment.',
        ]);
    }

    public function updateProfile(Request $request)
    {
        $member = $this->resolveMember($request);

        $validated = $request->validate([
            'phone' => 'sometimes|required|string|max:20',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:255',
            'emergency_contact_name' => 'nullable|string|max:100',
            'emergency_contact_phone' => 'nullable|string|max:30',
            'blood_group' => 'nullable|string|max:10',
        ]);

        $member->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully',
            'member' => $member->fresh(),
        ]);
    }
}
