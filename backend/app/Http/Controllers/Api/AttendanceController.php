<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Member;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $query = AttendanceLog::with([
            'member:id,first_name,last_name,member_code,phone,avatar_url,photo_data',
            'branch:id,name,code',
            'verifier:id,name',
        ]);

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $date = $request->input('date', now()->toDateString());
        $query->whereDate('check_in_at', $date);

        if ($request->filled('method')) {
            $query->where('method', $request->input('method'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->whereHas('member', function ($q) use ($search) {
                $q->where('first_name', 'like', $search)
                  ->orWhere('last_name', 'like', $search)
                  ->orWhere('member_code', 'like', $search)
                  ->orWhere('phone', 'like', $search);
            });
        }

        $logs = $query->latest('check_in_at')->paginate($request->input('per_page', 30));

        return response()->json($logs);
    }

    public function checkIn(Request $request)
    {
        $validated = $request->validate([
            'member_id' => ['required', 'exists:members,id'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'check_in_at' => ['nullable', 'date'],
            'method' => ['nullable', 'in:front_desk,qr_scan,biometric,manual'],
            'client_uuid' => ['nullable', 'uuid'],
        ]);

        // Idempotency: If check-in with this client_uuid exists, return it
        if (!empty($validated['client_uuid'])) {
            $existing = AttendanceLog::where('client_uuid', $validated['client_uuid'])->first();
            if ($existing) {
                return response()->json($existing->load('member'), 200);
            }
        }

        $member = Member::with('activeMembership.plan')->findOrFail($validated['member_id']);
        $branchId = $validated['branch_id'] ?? CurrentBranch::id() ?? $member->primary_branch_id;

        // Check if member is already checked in today without checking out
        $alreadyCheckedIn = AttendanceLog::where('member_id', $member->id)
            ->whereDate('check_in_at', now()->toDateString())
            ->whereNull('check_out_at')
            ->first();

        if ($alreadyCheckedIn) {
            return response()->json([
                'message' => "Member {$member->full_name} is already checked in.",
                'log' => $alreadyCheckedIn->load('member'),
                'already_checked_in' => true,
            ], 200);
        }

        $activeMembership = $member->activeMembership;
        $isExpired = !$activeMembership || $activeMembership->end_date->isPast();
        $isFrozen = $activeMembership && $activeMembership->status === 'frozen';

        $log = AttendanceLog::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $branchId,
            'member_id' => $member->id,
            'client_uuid' => $validated['client_uuid'] ?? null,
            'check_in_at' => $validated['check_in_at'] ?? now(),
            'method' => $validated['method'] ?? 'front_desk',
            'verified_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => "Check-in successful for {$member->full_name}.",
            'log' => $log->load('member'),
            'membership_status' => $activeMembership ? 'active' : 'expired_or_none',
            'is_expired' => $isExpired,
            'is_frozen' => $isFrozen,
            'outstanding_balance' => (float) $member->outstanding_balance,
        ], 201);
    }

    /**
     * QR check-in endpoint with instant member detection & validity inspection
     */
    public function qrCheckIn(Request $request)
    {
        $validated = $request->validate([
            'qr_data' => ['required', 'string'],
            'branch_id' => ['nullable', 'exists:branches,id'],
        ]);

        $query = Member::with(['activeMembership.plan', 'primaryBranch']);

        $qrInput = trim($validated['qr_data']);

        // Check if QR data is JSON: {"id":12,"code":"MEM-0001"}
        if (str_starts_with($qrInput, '{') && str_ends_with($qrInput, '}')) {
            $parsed = json_decode($qrInput, true);
            if (!empty($parsed['id'])) {
                $member = $query->find($parsed['id']);
            } elseif (!empty($parsed['code'])) {
                $member = $query->where('member_code', $parsed['code'])->first();
            }
        }

        if (empty($member)) {
            // Match by member_code or phone or ID
            $member = $query->where('member_code', $qrInput)
                ->orWhere('phone', $qrInput)
                ->orWhere('id', is_numeric($qrInput) ? (int)$qrInput : 0)
                ->first();
        }

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Member not found for QR / Code: ' . $qrInput,
            ], 404);
        }

        $branchId = $validated['branch_id'] ?? CurrentBranch::id() ?? $member->primary_branch_id;

        // Check active membership
        $activeMembership = $member->activeMembership;
        $isExpired = false;
        $isFrozen = false;
        $remainingDays = 0;

        if (!$activeMembership) {
            $isExpired = true;
        } else {
            $remainingDays = (int) now()->startOfDay()->diffInDays($activeMembership->end_date->startOfDay(), false);
            if ($remainingDays < 0) {
                $isExpired = true;
            }
            if ($activeMembership->status === 'frozen') {
                $isFrozen = true;
            }
        }

        // Check duplicate check-in
        $alreadyCheckedIn = AttendanceLog::where('member_id', $member->id)
            ->whereDate('check_in_at', now()->toDateString())
            ->whereNull('check_out_at')
            ->first();

        if ($alreadyCheckedIn) {
            // Auto check-out on second tap if user wants
            if ($request->boolean('toggle_checkout')) {
                $alreadyCheckedIn->update(['check_out_at' => now()]);
                return response()->json([
                    'success' => true,
                    'action' => 'checked_out',
                    'message' => "Checked out {$member->full_name}.",
                    'log' => $alreadyCheckedIn->fresh('member'),
                ]);
            }

            return response()->json([
                'success' => true,
                'already_inside' => true,
                'message' => "{$member->full_name} is already checked in since " . $alreadyCheckedIn->check_in_at->format('h:i A'),
                'log' => $alreadyCheckedIn->load('member'),
                'member' => $member,
                'is_expired' => $isExpired,
                'is_frozen' => $isFrozen,
                'remaining_days' => $remainingDays,
                'outstanding_balance' => (float) $member->outstanding_balance,
            ], 200);
        }

        $log = AttendanceLog::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $branchId,
            'member_id' => $member->id,
            'check_in_at' => now(),
            'method' => 'qr_scan',
            'verified_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'action' => 'checked_in',
            'message' => "Welcome {$member->full_name}! Check-in recorded.",
            'log' => $log->load('member'),
            'member' => $member,
            'plan_name' => $activeMembership?->plan?->name ?? 'No Plan',
            'is_expired' => $isExpired,
            'is_frozen' => $isFrozen,
            'remaining_days' => $remainingDays,
            'outstanding_balance' => (float) $member->outstanding_balance,
        ], 201);
    }

    public function checkOut(Request $request, int $id)
    {
        $log = AttendanceLog::findOrFail($id);

        if ($log->check_out_at) {
            return response()->json(['message' => 'Member has already checked out.', 'log' => $log]);
        }

        $log->update(['check_out_at' => now()]);

        return response()->json(['message' => 'Check-out recorded successfully.', 'log' => $log->fresh('member')]);
    }

    public function todayStats(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = AttendanceLog::whereDate('check_in_at', now()->toDateString());
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $totalToday = (clone $query)->count();
        $currentlyInside = (clone $query)->whereNull('check_out_at')->count();

        // Morning (before 12 PM) vs Evening (after 12 PM)
        $morningCount = (clone $query)->whereTime('check_in_at', '<', '12:00:00')->count();
        $eveningCount = (clone $query)->whereTime('check_in_at', '>=', '12:00:00')->count();

        return response()->json([
            'total_check_ins' => $totalToday,
            'currently_inside' => $currentlyInside,
            'morning_check_ins' => $morningCount,
            'evening_check_ins' => $eveningCount,
            'date' => now()->toDateString(),
        ]);
    }
}
