<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\GymQrCode;
use App\Models\Member;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SelfCheckInController extends Controller
{
    /**
     * Public endpoint: Validate QR token and get safe gym & branch info
     */
    public function info(Request $request, string $token)
    {
        $qr = GymQrCode::withoutGlobalScopes()
            ->where('token', $token)
            ->first();

        if (!$qr) {
            return response()->json([
                'valid' => false,
                'message' => 'Invalid or unrecognized QR code.',
            ], 404);
        }

        if (!$qr->is_active) {
            return response()->json([
                'valid' => false,
                'message' => 'This QR Code has been deactivated or revoked by gym management.',
            ], 410);
        }

        return CurrentGym::run($qr->gym_id, function () use ($qr) {
            $qr->load(['gym:id,name,logo_url,phone,status', 'branch:id,name,address,city,phone']);

            if ($qr->gym && in_array($qr->gym->status, ['suspended', 'cancelled'])) {
                return response()->json([
                    'valid' => false,
                    'message' => 'Gym facility operations are currently paused.',
                ], 403);
            }

            // Increment scan count for analytics
            $qr->increment('scan_count');
            $qr->update(['last_scanned_at' => now()]);

            return response()->json([
                'valid' => true,
                'gym' => [
                    'name' => $qr->gym?->name ?? 'Gym',
                    'logo_url' => $qr->gym?->logo_url,
                    'phone' => $qr->gym?->phone,
                ],
                'branch' => [
                    'name' => $qr->branch?->name ?? 'Branch',
                    'address' => $qr->branch?->address,
                    'city' => $qr->branch?->city,
                    'phone' => $qr->branch?->phone,
                ],
                'qr_code' => $qr->code,
                'require_location' => (bool) $qr->require_location,
                'radius_meters' => (int) $qr->radius_meters,
                'require_staff_confirmation' => (bool) $qr->require_staff_confirmation,
            ]);
        });
    }

    /**
     * Verify member identity by phone or authenticated session
     */
    public function verifyMember(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'phone' => ['nullable', 'string', 'max:25'],
        ]);

        $qr = GymQrCode::withoutGlobalScopes()
            ->where('token', $validated['token'])
            ->where('is_active', true)
            ->first();

        if (!$qr) {
            return response()->json([
                'message' => 'Invalid or revoked QR code.',
            ], 404);
        }

        return CurrentGym::run($qr->gym_id, function () use ($request, $qr, $validated) {
            $qr->load(['gym', 'branch']);

            // Check if user is authenticated as member
            $authUser = $request->user();
            $member = null;

            if ($authUser && $authUser->role === 'member' && $authUser->gym_id === $qr->gym_id) {
                $member = Member::with(['activeMembership.plan', 'primaryBranch'])
                    ->where('gym_id', $qr->gym_id)
                    ->where(function ($q) use ($authUser) {
                        $q->where('phone', $authUser->phone)->orWhere('email', $authUser->email);
                    })
                    ->first();
            }

            if (!$member) {
                $phoneInput = trim($validated['phone'] ?? '');
                if (!$phoneInput) {
                    return response()->json([
                        'message' => 'Please provide your registered mobile number or Member ID.',
                    ], 422);
                }

                // Clean phone string (e.g. +91 9876543210 -> 9876543210)
                $cleanPhone = preg_replace('/[^0-9]/', '', $phoneInput);
                if (strlen($cleanPhone) >= 10) {
                    $last10 = substr($cleanPhone, -10);
                } else {
                    $last10 = $cleanPhone;
                }

                $member = Member::with(['activeMembership.plan', 'primaryBranch'])
                    ->where('gym_id', $qr->gym_id)
                    ->where(function ($q) use ($phoneInput, $last10) {
                        $q->where('phone', $phoneInput)
                          ->orWhere('phone', 'like', "%{$last10}")
                          ->orWhere('member_code', $phoneInput);
                    })
                    ->first();
            }

            if (!$member) {
                return response()->json([
                    'message' => 'No active member record found matching this mobile number or ID at ' . ($qr->gym?->name ?? 'this gym') . '.',
                ], 404);
            }

            if ($member->status === 'inactive') {
                return response()->json([
                    'message' => 'Your membership profile is currently inactive. Please speak with gym staff.',
                ], 422);
            }

            $activeMembership = $member->activeMembership;

            if (!$activeMembership) {
                $latestMembership = $member->memberships()->latest('end_date')->first();
                if ($latestMembership) {
                    if ($latestMembership->status === 'frozen') {
                        return response()->json([
                            'message' => 'Your membership is currently frozen. Please unfreeze it before marking floor attendance.',
                        ], 422);
                    }
                    if ($latestMembership->end_date && $latestMembership->end_date->isPast()) {
                        return response()->json([
                            'message' => "Your membership expired on {$latestMembership->end_date->toDateString()}. Please renew at the front desk.",
                        ], 422);
                    }
                }

                return response()->json([
                    'message' => 'No active membership plan found for your account. Please renew your membership at the front desk.',
                ], 422);
            }

            if ($activeMembership->status === 'frozen') {
                return response()->json([
                    'message' => 'Your membership is currently frozen. Please unfreeze it before marking floor attendance.',
                ], 422);
            }

            if ($activeMembership->end_date->isPast()) {
                return response()->json([
                    'message' => "Your membership expired on {$activeMembership->end_date->toDateString()}. Please renew at the front desk.",
                ], 422);
            }

            // Check if member is already checked in today without checking out
            $alreadyCheckedIn = AttendanceLog::where('member_id', $member->id)
                ->whereDate('check_in_at', now()->toDateString())
                ->whereNull('check_out_at')
                ->first();

            if ($alreadyCheckedIn) {
                return response()->json([
                    'already_checked_in' => true,
                    'message' => "You have already checked in today at {$alreadyCheckedIn->check_in_at->format('h:i A')}.",
                    'check_in_time' => $alreadyCheckedIn->check_in_at->format('h:i A'),
                    'member' => [
                        'id' => $member->id,
                        'name' => $member->full_name,
                        'member_code' => $member->member_code,
                        'plan_name' => $activeMembership->plan?->name ?? 'Active Plan',
                    ],
                ], 200);
            }

            // Generate signed confirmation token valid for 15 minutes
            $timestamp = time();
            $payload = "{$member->id}|{$qr->id}|{$qr->branch_id}|{$timestamp}";
            $signature = hash_hmac('sha256', $payload, config('app.key'));
            $confirmationToken = base64_encode("{$payload}|{$signature}");

            $daysRemaining = (int) max(0, now()->startOfDay()->diffInDays($activeMembership->end_date->startOfDay(), false));

            return response()->json([
                'success' => true,
                'member' => [
                    'id' => $member->id,
                    'name' => $member->full_name,
                    'member_code' => $member->member_code,
                    'phone' => substr($member->phone, 0, 3) . '****' . substr($member->phone, -3),
                    'plan_name' => $activeMembership->plan?->name ?? 'Standard Membership',
                    'end_date' => $activeMembership->end_date->toDateString(),
                    'days_remaining' => $daysRemaining,
                    'outstanding_balance' => (float) $member->outstanding_balance,
                ],
                'confirmation_token' => $confirmationToken,
            ]);
        });
    }

    /**
     * Confirm attendance check-in after member verification
     */
    public function confirm(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'confirmation_token' => ['required', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $qr = GymQrCode::withoutGlobalScopes()
            ->where('token', $validated['token'])
            ->where('is_active', true)
            ->first();

        if (!$qr) {
            return response()->json([
                'message' => 'Invalid or revoked QR code.',
            ], 404);
        }

        return CurrentGym::run($qr->gym_id, function () use ($request, $qr, $validated) {
            $qr->load(['branch', 'gym']);

            // Decode and verify confirmation token
            $decoded = base64_decode($validated['confirmation_token'], true);
            if (!$decoded) {
                return response()->json(['message' => 'Invalid confirmation token.'], 403);
            }

            $parts = explode('|', $decoded);
            if (count($parts) !== 5) {
                return response()->json(['message' => 'Malformed confirmation token.'], 403);
            }

            [$memberId, $qrId, $branchId, $timestamp, $signature] = $parts;

            // Verify HMAC
            $expectedPayload = "{$memberId}|{$qrId}|{$branchId}|{$timestamp}";
            $expectedSignature = hash_hmac('sha256', $expectedPayload, config('app.key'));

            if (!hash_equals($expectedSignature, $signature)) {
                return response()->json(['message' => 'Confirmation token signature is invalid or tampered.'], 403);
            }

            // Expiration check (15 minutes)
            if (time() - (int) $timestamp > 900) {
                return response()->json(['message' => 'Confirmation session expired. Please verify your number again.'], 422);
            }

            // Validate QR match
            if ((int) $qrId !== $qr->id || (int) $branchId !== $qr->branch_id) {
                return response()->json(['message' => 'QR token and confirmation context mismatch.'], 403);
            }

            // Load member & verify gym isolation
            $member = Member::with('activeMembership.plan')->where('gym_id', $qr->gym_id)->findOrFail((int) $memberId);

            $activeMembership = $member->activeMembership;
            if (!$activeMembership || $activeMembership->end_date->isPast() || $activeMembership->status === 'frozen') {
                return response()->json(['message' => 'Cannot record attendance: Membership is expired or frozen.'], 422);
            }

            // Verify Geolocation if QR requires location
            if ($qr->require_location && $qr->latitude !== null && $qr->longitude !== null) {
                $userLat = $validated['latitude'] ?? null;
                $userLon = $validated['longitude'] ?? null;

                if ($userLat === null || $userLon === null) {
                    return response()->json([
                        'message' => 'Gym policy requires GPS location verification. Please allow location permissions to check in.',
                    ], 422);
                }

                $distance = $qr->distanceMeters((float) $userLat, (float) $userLon);
                if ($distance !== null && $distance > $qr->radius_meters) {
                    return response()->json([
                        'message' => "Location verification failed: You are {$distance}m away from the gym entrance (maximum allowed: {$qr->radius_meters}m).",
                    ], 422);
                }
            }

            return DB::transaction(function () use ($qr, $member, $activeMembership, $validated, $request) {
                // Re-check duplicate check-in today inside transaction
                $alreadyCheckedIn = AttendanceLog::where('member_id', $member->id)
                    ->whereDate('check_in_at', now()->toDateString())
                    ->whereNull('check_out_at')
                    ->lockForUpdate()
                    ->first();

                if ($alreadyCheckedIn) {
                    return response()->json([
                        'already_checked_in' => true,
                        'message' => "You are already checked in today at {$alreadyCheckedIn->check_in_at->format('h:i A')}.",
                        'check_in_time' => $alreadyCheckedIn->check_in_at->format('h:i A'),
                        'branch_name' => $qr->branch?->name,
                    ], 200);
                }

                $log = AttendanceLog::create([
                    'gym_id' => $qr->gym_id,
                    'branch_id' => $qr->branch_id,
                    'member_id' => $member->id,
                    'gym_qr_code_id' => $qr->id,
                    'check_in_at' => now(),
                    'method' => 'qr_self_check_in',
                    'latitude' => $validated['latitude'] ?? null,
                    'longitude' => $validated['longitude'] ?? null,
                    'verified_by_user_id' => null, // Self-attendance
                ]);

                AuditLog::create([
                    'gym_id' => $qr->gym_id,
                    'branch_id' => $qr->branch_id,
                    'event' => 'member.self_check_in',
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'payload' => [
                        'member_id' => $member->id,
                        'member_code' => $member->member_code,
                        'qr_id' => $qr->id,
                        'log_id' => $log->id,
                    ],
                ]);

                return response()->json([
                    'success' => true,
                    'message' => "Welcome, {$member->first_name}! Your attendance has been marked successfully.",
                    'check_in_time' => $log->check_in_at->format('h:i A'),
                    'check_in_date' => $log->check_in_at->toDateString(),
                    'branch_name' => $qr->branch?->name,
                    'member_name' => $member->full_name,
                    'member_code' => $member->member_code,
                    'plan_name' => $activeMembership->plan?->name ?? 'Standard Membership',
                    'log_id' => $log->id,
                ], 201);
            });
        });
    }
}
