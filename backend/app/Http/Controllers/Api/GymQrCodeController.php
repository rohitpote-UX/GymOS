<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\GymQrCode;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class GymQrCodeController extends Controller
{
    public function index(Request $request)
    {
        $gymId = CurrentGym::require();
        $query = GymQrCode::with(['branch:id,name,code,address,phone'])
            ->where('gym_id', $gymId);

        $branchId = $request->query('branch_id');
        if ($branchId && $branchId !== 'all') {
            $query->where('branch_id', $branchId);
        }

        $qrCodes = $query->latest()->get();

        return response()->json([
            'data' => $qrCodes,
        ]);
    }

    public function store(Request $request)
    {
        $gymId = CurrentGym::require();

        $validated = $request->validate([
            'branch_id' => ['nullable', 'exists:branches,id'],
            'name' => ['nullable', 'string', 'max:120'],
            'require_location' => ['nullable', 'boolean'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['nullable', 'integer', 'min:20', 'max:5000'],
            'require_staff_confirmation' => ['nullable', 'boolean'],
            'rotating_mode' => ['nullable', 'boolean'],
        ]);

        $branchId = $validated['branch_id'] ?? CurrentBranch::id();
        if (!$branchId) {
            $primaryBranch = Branch::where('gym_id', $gymId)->where('is_primary', true)->first()
                ?? Branch::where('gym_id', $gymId)->firstOrFail();
            $branchId = $primaryBranch->id;
        } else {
            // Verify branch belongs to gym
            Branch::where('gym_id', $gymId)->findOrFail($branchId);
        }

        $qr = GymQrCode::createUnique(
            gymId: $gymId,
            branchId: $branchId,
            userId: $request->user()?->id,
            attributes: array_filter($validated, fn ($val) => $val !== null)
        );

        AuditLog::create([
            'gym_id' => $gymId,
            'branch_id' => $branchId,
            'user_id' => $request->user()?->id,
            'event' => 'gym_qr_code.created',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['qr_id' => $qr->id, 'code' => $qr->code],
        ]);

        return response()->json([
            'message' => 'QR Code generated successfully.',
            'qr' => $qr->load('branch'),
        ], 201);
    }

    public function show(Request $request, int $id)
    {
        $gymId = CurrentGym::require();
        $qr = GymQrCode::with(['branch', 'creator:id,name'])->where('gym_id', $gymId)->findOrFail($id);

        $todayScans = AttendanceLog::where('gym_qr_code_id', $qr->id)
            ->whereDate('check_in_at', now()->toDateString())
            ->count();

        return response()->json([
            'qr' => $qr,
            'stats' => [
                'total_scans' => $qr->scan_count,
                'today_scans' => $todayScans,
                'last_scanned_at' => $qr->last_scanned_at?->toIso8601String(),
            ],
        ]);
    }

    public function update(Request $request, int $id)
    {
        $gymId = CurrentGym::require();
        $qr = GymQrCode::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'require_location' => ['sometimes', 'boolean'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['sometimes', 'integer', 'min:20', 'max:5000'],
            'require_staff_confirmation' => ['sometimes', 'boolean'],
            'rotating_mode' => ['sometimes', 'boolean'],
        ]);

        $qr->update($validated);

        return response()->json([
            'message' => 'QR settings updated successfully.',
            'qr' => $qr->fresh('branch'),
        ]);
    }

    public function regenerate(Request $request, int $id)
    {
        $gymId = CurrentGym::require();
        $qr = GymQrCode::where('gym_id', $gymId)->findOrFail($id);

        $oldCode = $qr->code;
        $qr->regenerateToken();

        AuditLog::create([
            'gym_id' => $gymId,
            'branch_id' => $qr->branch_id,
            'user_id' => $request->user()?->id,
            'event' => 'gym_qr_code.regenerated',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['qr_id' => $qr->id, 'old_code' => $oldCode, 'new_code' => $qr->code],
        ]);

        return response()->json([
            'message' => 'QR code token regenerated successfully. Old printed copies have been revoked.',
            'qr' => $qr->fresh('branch'),
        ]);
    }

    public function toggleStatus(Request $request, int $id)
    {
        $gymId = CurrentGym::require();
        $qr = GymQrCode::where('gym_id', $gymId)->findOrFail($id);

        $newActive = !$qr->is_active;
        $qr->update([
            'is_active' => $newActive,
            'deactivated_at' => $newActive ? null : now(),
        ]);

        AuditLog::create([
            'gym_id' => $gymId,
            'branch_id' => $qr->branch_id,
            'user_id' => $request->user()?->id,
            'event' => $newActive ? 'gym_qr_code.activated' : 'gym_qr_code.deactivated',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['qr_id' => $qr->id, 'is_active' => $newActive],
        ]);

        return response()->json([
            'message' => $newActive ? 'QR code activated successfully.' : 'QR code deactivated successfully.',
            'qr' => $qr->fresh('branch'),
        ]);
    }

    public function activity(Request $request, int $id)
    {
        $gymId = CurrentGym::require();
        $qr = GymQrCode::where('gym_id', $gymId)->findOrFail($id);

        $logs = AttendanceLog::with(['member:id,first_name,last_name,member_code,phone,avatar_url'])
            ->where('gym_qr_code_id', $qr->id)
            ->latest('check_in_at')
            ->take(30)
            ->get();

        return response()->json([
            'data' => $logs,
        ]);
    }
}
