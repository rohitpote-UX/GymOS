<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\PtSession;
use App\Models\StaffLeave;
use App\Models\User;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TrainerController extends Controller
{
    /**
     * List all trainers with specialization, active clients, and session metrics.
     */
    public function index(Request $request)
    {
        $query = User::where('gym_id', CurrentGym::id())
            ->where(function ($q) {
                $q->where('role', User::ROLE_TRAINER)
                  ->orWhere('role', User::ROLE_BRANCH_MANAGER);
            })
            ->with(['primaryBranch:id,name', 'branches:id,name'])
            ->withCount([
                'assignedMembers as active_clients_count' => fn ($q) => $q->where('status', 'active'),
                'ptSessions as completed_sessions_this_month' => fn ($q) => $q->where('status', 'completed')
                    ->whereBetween('session_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()]),
            ]);

        $trainers = $query->get();

        return response()->json($trainers);
    }

    /**
     * Assign trainer to member.
     */
    public function assignMember(Request $request)
    {
        $validated = $request->validate([
            'member_id' => ['required', 'exists:members,id'],
            'trainer_id' => ['required', 'exists:users,id'],
        ]);

        $member = Member::findOrFail($validated['member_id']);
        $trainer = User::where('gym_id', CurrentGym::id())->findOrFail($validated['trainer_id']);

        $member->update(['assigned_trainer_id' => $trainer->id]);

        // If member has active PT membership, assign trainer to it as well
        $ptMembership = $member->memberships()
            ->where('status', 'active')
            ->where('category', 'personal_training')
            ->latest('id')
            ->first();

        if ($ptMembership) {
            $ptMembership->update(['assigned_trainer_id' => $trainer->id]);
        }

        AuditLog::record('trainer.assigned_to_member', [
            'member_id' => $member->id,
            'trainer_id' => $trainer->id,
        ], $member->primary_branch_id);

        return response()->json([
            'message' => "Trainer {$trainer->name} assigned to {$member->full_name}.",
            'member' => $member->load('trainer'),
        ]);
    }

    /**
     * List PT Sessions.
     */
    public function sessions(Request $request)
    {
        $query = PtSession::with([
            'member:id,member_code,first_name,last_name,phone',
            'trainer:id,name',
            'branch:id,name',
            'membership.plan:id,name',
        ]);

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('trainer_id')) {
            $query->where('trainer_id', $request->input('trainer_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('date')) {
            $query->whereDate('session_date', $request->input('date'));
        }

        $sessions = $query->latest('session_date')->latest('id')->paginate($request->input('per_page', 25));

        return response()->json($sessions);
    }

    /**
     * Schedule a new PT session.
     */
    public function scheduleSession(Request $request)
    {
        $validated = $request->validate([
            'member_id' => ['required', 'exists:members,id'],
            'trainer_id' => ['required', 'exists:users,id'],
            'session_date' => ['required', 'date'],
            'start_time' => ['nullable'],
            'duration_minutes' => ['nullable', 'integer', 'min:15', 'max:240'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'exists:branches,id'],
        ]);

        $member = Member::findOrFail($validated['member_id']);
        $branchId = $validated['branch_id'] ?? CurrentBranch::id() ?? $member->primary_branch_id;

        // Check if member has an active PT membership with remaining sessions
        $ptMembership = $member->memberships()
            ->where('status', 'active')
            ->where(function ($q) {
                $q->where('category', 'personal_training')
                  ->orWhere('total_pt_sessions', '>', 0);
            })
            ->latest('id')
            ->first();

        $session = PtSession::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $branchId,
            'member_id' => $member->id,
            'trainer_id' => $validated['trainer_id'],
            'member_membership_id' => $ptMembership?->id,
            'session_date' => $validated['session_date'],
            'start_time' => $validated['start_time'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? 60,
            'status' => 'scheduled',
            'trainer_notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'PT session scheduled successfully.',
            'session' => $session->load(['member', 'trainer', 'branch']),
        ], 201);
    }

    /**
     * Mark PT session as completed.
     */
    public function completeSession(Request $request, int $id)
    {
        $session = PtSession::with('membership')->findOrFail($id);

        if ($session->status === 'completed') {
            return response()->json(['message' => 'Session is already marked completed.'], 422);
        }

        return DB::transaction(function () use ($session, $request) {
            $session->update([
                'status' => 'completed',
                'completed_at' => now(),
                'trainer_notes' => $request->input('trainer_notes', $session->trainer_notes),
                'client_feedback' => $request->input('client_feedback', $session->client_feedback),
            ]);

            // Increment completed sessions count on membership
            if ($session->membership) {
                $session->membership->increment('completed_pt_sessions');
            }

            return response()->json([
                'message' => 'Personal training session recorded as completed.',
                'session' => $session->fresh(['member', 'trainer', 'membership']),
            ]);
        });
    }

    /**
     * List Staff Leaves.
     */
    public function leaves(Request $request)
    {
        $query = StaffLeave::with(['user:id,name,role', 'branch:id,name', 'approver:id,name']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        $leaves = $query->latest('id')->paginate(20);

        return response()->json($leaves);
    }

    /**
     * Submit leave request.
     */
    public function applyLeave(Request $request)
    {
        $validated = $request->validate([
            'leave_type' => ['required', 'in:sick,casual,annual,unpaid'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'days_count' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string'],
        ]);

        $user = $request->user();

        $leave = StaffLeave::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $user->primary_branch_id,
            'user_id' => $user->id,
            'leave_type' => $validated['leave_type'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'days_count' => $validated['days_count'],
            'reason' => $validated['reason'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json($leave->load(['user', 'branch']), 201);
    }

    /**
     * Approve or Reject Leave Request.
     */
    public function reviewLeave(Request $request, int $id)
    {
        $leave = StaffLeave::findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
        ]);

        $leave->update([
            'status' => $validated['status'],
            'approved_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['message' => "Leave marked as {$validated['status']}.", 'leave' => $leave->fresh(['user', 'approver'])]);
    }

    /**
     * Trainer performance & compensation report.
     */
    public function performanceReport(Request $request)
    {
        $month = $request->input('month', now()->format('Y-m'));
        $start = "{$month}-01";
        $end = date('Y-m-t', strtotime($start));

        $trainers = User::where('gym_id', CurrentGym::id())
            ->where('role', User::ROLE_TRAINER)
            ->get();

        $report = $trainers->map(function ($trainer) use ($start, $end) {
            $completedSessions = PtSession::where('trainer_id', $trainer->id)
                ->where('status', 'completed')
                ->whereBetween('session_date', [$start, $end])
                ->count();

            $activeClients = Member::where('assigned_trainer_id', $trainer->id)
                ->where('status', 'active')
                ->count();

            $baseSalary = (float) $trainer->base_salary;
            $ptRate = (float) $trainer->pt_session_rate;
            $ptEarnings = $completedSessions * $ptRate;
            $totalPayout = $baseSalary + $ptEarnings;

            return [
                'trainer_id' => $trainer->id,
                'name' => $trainer->name,
                'specialization' => $trainer->specialization,
                'active_clients' => $activeClients,
                'completed_sessions' => $completedSessions,
                'base_salary' => $baseSalary,
                'pt_session_rate' => $ptRate,
                'pt_earnings' => $ptEarnings,
                'total_payout_estimated' => $totalPayout,
            ];
        });

        return response()->json([
            'month' => $month,
            'trainers' => $report,
        ]);
    }
}
