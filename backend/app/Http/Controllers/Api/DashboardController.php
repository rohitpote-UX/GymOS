<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\Payment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        // 1. Members
        $membersQuery = Member::query();
        if ($branchId) {
            $membersQuery->where('primary_branch_id', $branchId);
        }
        $totalMembers = (clone $membersQuery)->count();
        $activeMembers = (clone $membersQuery)->where('status', 'active')->count();

        // 2. Expiring Memberships in next 7 days
        $expiringQuery = MemberMembership::with(['member:id,first_name,last_name,phone,member_code', 'plan:id,name'])
            ->where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()]);
        if ($branchId) {
            $expiringQuery->where('branch_id', $branchId);
        }
        $expiringMemberships = $expiringQuery->orderBy('end_date')->take(6)->get();

        // 3. Attendance
        $attendanceQuery = AttendanceLog::whereDate('check_in_at', now()->toDateString());
        if ($branchId) {
            $attendanceQuery->where('branch_id', $branchId);
        }
        $todayCheckIns = (clone $attendanceQuery)->count();
        $currentlyInside = (clone $attendanceQuery)->whereNull('check_out_at')->count();

        // 4. Financials
        $paymentQuery = Payment::where('status', 'completed');
        if ($branchId) {
            $paymentQuery->where('branch_id', $branchId);
        }
        $todayRevenue = (clone $paymentQuery)->whereDate('payment_date', now()->toDateString())->sum('amount');
        $thisMonthRevenue = (clone $paymentQuery)->whereBetween('payment_date', [
            now()->startOfMonth()->toDateString(),
            now()->endOfMonth()->toDateString(),
        ])->sum('amount');

        // 5. Recent Payments
        $recentPayments = (clone $paymentQuery)
            ->with(['member:id,first_name,last_name,member_code', 'branch:id,name'])
            ->latest('id')
            ->take(5)
            ->get();

        // 6. Branch Distribution (if multi-branch)
        $branches = Branch::withCount(['members', 'staff'])->get();

        return response()->json([
            'metrics' => [
                'total_members' => $totalMembers,
                'active_members' => $activeMembers,
                'today_check_ins' => $todayCheckIns,
                'currently_inside' => $currentlyInside,
                'today_revenue' => (float) $todayRevenue,
                'monthly_revenue' => (float) $thisMonthRevenue,
            ],
            'expiring_soon' => $expiringMemberships,
            'recent_payments' => $recentPayments,
            'branches' => $branches,
        ]);
    }
}
