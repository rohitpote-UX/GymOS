<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\GymQrCode;
use App\Models\Member;
use App\Services\VisitorPassService;
use App\Support\CurrentGym;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SelfCheckInController extends Controller
{
    protected VisitorPassService $visitorPassService;

    public function __construct(VisitorPassService $visitorPassService)
    {
        $this->visitorPassService = $visitorPassService;
    }

    /**
     * Public endpoint: Resolve check-in facility by gym slug & branch code
     * e.g. /checkin/{gym_slug}/{branch_code}
     */
    public function resolveBySlug(Request $request, string $gymSlug, string $branchCode): JsonResponse
    {
        // 1. Locate gym by slug or sanitized identifier
        $cleanGymSlug = Str::slug($gymSlug);
        $gym = Gym::withoutGlobalScopes()
            ->where('slug', $gymSlug)
            ->orWhere('slug', $cleanGymSlug)
            ->orWhere('id', is_numeric($gymSlug) ? (int)$gymSlug : 0)
            ->first();

        if (!$gym) {
            // Also try matching normalized name
            $gym = Gym::withoutGlobalScopes()
                ->whereRaw('LOWER(REPLACE(name, " ", "-")) = ?', [strtolower($gymSlug)])
                ->first();
        }

        if (!$gym) {
            return response()->json([
                'valid' => false,
                'message' => 'Gym facility not found.',
            ], 404);
        }

        if (in_array($gym->status, ['suspended', 'cancelled'])) {
            return response()->json([
                'valid' => false,
                'message' => 'Gym facility operations are currently paused.',
            ], 403);
        }

        // 2. Locate branch by code, slug or ID
        $cleanBranchCode = strtoupper(trim($branchCode));
        $branch = Branch::withoutGlobalScopes()
            ->where('gym_id', $gym->id)
            ->where(function ($q) use ($cleanBranchCode, $branchCode) {
                $q->where('code', $cleanBranchCode)
                  ->orWhere('code', $branchCode)
                  ->orWhere('id', is_numeric($branchCode) ? (int)$branchCode : 0);
            })
            ->first();

        if (!$branch) {
            // Fallback to primary branch or first active branch
            $branch = Branch::withoutGlobalScopes()
                ->where('gym_id', $gym->id)
                ->where('is_primary', true)
                ->first()
                ?? Branch::withoutGlobalScopes()->where('gym_id', $gym->id)->first();
        }

        if (!$branch) {
            return response()->json([
                'valid' => false,
                'message' => 'Gym branch could not be identified.',
            ], 404);
        }

        // 3. Find or auto-provision active GymQrCode for this branch
        $qr = GymQrCode::withoutGlobalScopes()
            ->where('gym_id', $gym->id)
            ->where('branch_id', $branch->id)
            ->where('is_active', true)
            ->latest('id')
            ->first();

        if (!$qr) {
            $qr = GymQrCode::createUnique(
                gymId: $gym->id,
                branchId: $branch->id,
                userId: null,
                attributes: ['name' => "{$branch->name} Primary QR"]
            );
        }

        // Increment scan count for analytics
        $qr->increment('scan_count');
        $qr->update(['last_scanned_at' => now()]);

        // Pricing & settings for visitor pass and dues policy
        $pricing = $this->visitorPassService->getPassPricing($branch);
        $gymSettings = $gym->settings ?? [];
        $duesPolicy = $gymSettings['dues_policy'] ?? 'allow_with_warning'; // 'allow_with_warning' | 'block_until_paid'

        return response()->json([
            'valid' => true,
            'token' => $qr->token,
            'qr_code' => $qr->code,
            'gym' => [
                'id' => $gym->id,
                'name' => $gym->name,
                'slug' => $gym->slug,
                'logo_url' => $gym->logo_url,
                'phone' => $gym->phone,
            ],
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'address' => $branch->address,
                'city' => $branch->city,
                'phone' => $branch->phone,
            ],
            'visitor_pass' => $pricing,
            'settings' => [
                'dues_policy' => $duesPolicy,
                'require_location' => (bool) $qr->require_location,
                'radius_meters' => (int) $qr->radius_meters,
            ],
        ]);
    }

    /**
     * Public endpoint: Validate QR token and get safe gym & branch info
     */
    public function info(Request $request, string $token): JsonResponse
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
            $qr->load(['gym:id,name,slug,logo_url,phone,status,settings', 'branch:id,name,code,address,city,phone,visitor_pass_enabled,one_day_pass_price,one_day_pass_gst_rate,visitor_access_hours']);

            if ($qr->gym && in_array($qr->gym->status, ['suspended', 'cancelled'])) {
                return response()->json([
                    'valid' => false,
                    'message' => 'Gym facility operations are currently paused.',
                ], 403);
            }

            // Increment scan count for analytics
            $qr->increment('scan_count');
            $qr->update(['last_scanned_at' => now()]);

            $branch = $qr->branch;
            $pricing = $branch ? $this->visitorPassService->getPassPricing($branch) : [
                'enabled' => false,
                'base_price' => 200,
                'gst_rate' => 18,
                'gst_amount' => 36,
                'total_amount' => 236,
                'currency' => 'INR',
                'access_hours' => '06:00 AM - 10:00 PM',
            ];

            $gymSettings = $qr->gym?->settings ?? [];
            $duesPolicy = $gymSettings['dues_policy'] ?? 'allow_with_warning';

            return response()->json([
                'valid' => true,
                'token' => $qr->token,
                'qr_code' => $qr->code,
                'gym' => [
                    'id' => $qr->gym?->id,
                    'name' => $qr->gym?->name ?? 'GymOS',
                    'slug' => $qr->gym?->slug,
                    'logo_url' => $qr->gym?->logo_url,
                    'phone' => $qr->gym?->phone,
                ],
                'branch' => [
                    'id' => $qr->branch?->id,
                    'name' => $qr->branch?->name ?? 'Branch',
                    'code' => $qr->branch?->code,
                    'address' => $qr->branch?->address,
                    'city' => $qr->branch?->city,
                    'phone' => $qr->branch?->phone,
                ],
                'visitor_pass' => $pricing,
                'settings' => [
                    'dues_policy' => $duesPolicy,
                    'require_location' => (bool) $qr->require_location,
                    'radius_meters' => (int) $qr->radius_meters,
                    'require_staff_confirmation' => (bool) $qr->require_staff_confirmation,
                ],
            ]);
        });
    }

    /**
     * Verify member identity by phone or authenticated session
     */
    public function verifyMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'phone' => ['nullable', 'string', 'max:50'],
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

            // 1. Check if user is authenticated as member
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

            // 2. Lookup by phone or member code input
            if (!$member) {
                $phoneInput = trim($validated['phone'] ?? '');
                if (!$phoneInput) {
                    return response()->json([
                        'message' => 'Please provide your registered mobile number or Member ID.',
                    ], 422);
                }

                $cleanPhone = preg_replace('/[^0-9]/', '', $phoneInput);
                $last10 = strlen($cleanPhone) >= 10 ? substr($cleanPhone, -10) : $cleanPhone;

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
                    'message' => 'No active member record found matching this mobile number or Member ID at ' . ($qr->gym?->name ?? 'this gym') . '.',
                ], 404);
            }

            if ($member->status === 'inactive') {
                return response()->json([
                    'message' => 'Your membership profile is currently inactive. Please speak with gym staff.',
                ], 422);
            }

            // Membership validation
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

            if ($activeMembership->end_date && $activeMembership->end_date->isPast()) {
                return response()->json([
                    'message' => "Your membership expired on {$activeMembership->end_date->toDateString()}. Please renew at the front desk.",
                ], 422);
            }

            // Dues policy check
            $gymSettings = $qr->gym?->settings ?? [];
            $duesPolicy = $gymSettings['dues_policy'] ?? 'allow_with_warning';
            $outstanding = (float) ($member->outstanding_balance ?? 0);

            if ($duesPolicy === 'block_until_paid' && $outstanding > 0) {
                return response()->json([
                    'message' => "Check-in blocked: You have an outstanding fee balance of ₹{$outstanding}. Please clear dues at the front desk to enter.",
                    'dues_blocked' => true,
                    'outstanding_balance' => $outstanding,
                ], 422);
            }

            // Duplicate check-in today check
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

            // Signed confirmation token valid for 15 minutes
            $timestamp = time();
            $payload = "{$member->id}|{$qr->id}|{$qr->branch_id}|{$timestamp}";
            $signature = hash_hmac('sha256', $payload, config('app.key'));
            $confirmationToken = base64_encode("{$payload}|{$signature}");

            $daysRemaining = $activeMembership->end_date
                ? (int) max(0, now()->startOfDay()->diffInDays($activeMembership->end_date->startOfDay(), false))
                : 999;

            return response()->json([
                'success' => true,
                'member' => [
                    'id' => $member->id,
                    'name' => $member->full_name,
                    'member_code' => $member->member_code,
                    'phone' => substr($member->phone, 0, 3) . '****' . substr($member->phone, -3),
                    'raw_phone' => $member->phone,
                    'plan_name' => $activeMembership->plan?->name ?? 'Standard Membership',
                    'end_date' => $activeMembership->end_date?->toDateString(),
                    'days_remaining' => $daysRemaining,
                    'outstanding_balance' => $outstanding,
                    'dues_warning' => ($duesPolicy === 'allow_with_warning' && $outstanding > 0)
                        ? "Notice: You have pending dues of ₹{$outstanding}. Please clear it at reception."
                        : null,
                ],
                'confirmation_token' => $confirmationToken,
            ]);
        });
    }

    /**
     * Confirm attendance check-in after member verification
     */
    public function confirm(Request $request): JsonResponse
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

            $member = Member::with('activeMembership.plan')->where('gym_id', $qr->gym_id)->findOrFail((int) $memberId);
            $activeMembership = $member->activeMembership;
            if (!$activeMembership || ($activeMembership->end_date && $activeMembership->end_date->isPast()) || $activeMembership->status === 'frozen') {
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
                    'person_type' => 'member',
                    'gym_qr_code_id' => $qr->id,
                    'qr_reference' => $qr->code,
                    'check_in_at' => now(),
                    'method' => 'qr_self_check_in',
                    'latitude' => $validated['latitude'] ?? null,
                    'longitude' => $validated['longitude'] ?? null,
                    'verified_by_user_id' => null,
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

    /**
     * Public endpoint: Initialize 1-Day Visitor Pass order
     */
    public function visitorOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['nullable', 'string'],
            'gym_slug' => ['nullable', 'string'],
            'branch_code' => ['nullable', 'string'],
            'full_name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'gender' => ['nullable', 'string', 'in:male,female,other'],
            'emergency_contact' => ['nullable', 'string', 'max:20'],
        ]);

        $branch = null;

        if (!empty($validated['token'])) {
            $qr = GymQrCode::withoutGlobalScopes()
                ->where('token', $validated['token'])
                ->where('is_active', true)
                ->first();

            if ($qr) {
                $branch = Branch::withoutGlobalScopes()->where('id', $qr->branch_id)->first();
            }
        }

        if (!$branch && !empty($validated['gym_slug']) && !empty($validated['branch_code'])) {
            $gym = Gym::withoutGlobalScopes()->where('slug', $validated['gym_slug'])->first();
            if ($gym) {
                $branch = Branch::withoutGlobalScopes()
                    ->where('gym_id', $gym->id)
                    ->where(function ($q) use ($validated) {
                        $q->where('code', $validated['branch_code'])
                          ->orWhere('id', is_numeric($validated['branch_code']) ? (int)$validated['branch_code'] : 0);
                    })
                    ->first();
            }
        }

        if (!$branch) {
            return response()->json([
                'message' => 'Unable to determine facility branch for visitor pass order.',
            ], 404);
        }

        try {
            $pass = $this->visitorPassService->createPendingPass($branch, $validated);

            $razorpayKeyId = config('services.razorpay.key_id') ?: env('RAZORPAY_KEY_ID', 'rzp_test_public_demo');

            return response()->json([
                'success' => true,
                'pass_code' => $pass->pass_code,
                'pass_id' => $pass->id,
                'order_id' => $pass->razorpay_order_id,
                'razorpay_key_id' => $razorpayKeyId,
                'amount_paise' => (int) round($pass->total_amount * 100),
                'pricing' => [
                    'base_price' => $pass->base_amount,
                    'gst_rate' => $pass->gst_rate,
                    'gst_amount' => $pass->gst_amount,
                    'total_amount' => $pass->total_amount,
                    'currency' => $pass->currency,
                ],
                'visitor' => [
                    'full_name' => $pass->full_name,
                    'phone' => $pass->phone,
                    'email' => $pass->email,
                ],
                'gym_name' => $branch->gym?->name ?? 'Gym Facility',
                'branch_name' => $branch->name,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Public endpoint: Verify visitor payment & activate 1-day pass
     */
    public function visitorVerifyPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pass_code' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_order_id' => ['nullable', 'string'],
            'razorpay_signature' => ['nullable', 'string'],
        ]);

        try {
            $result = $this->visitorPassService->verifyAndConfirmPayment(
                passCode: $validated['pass_code'],
                paymentId: $validated['razorpay_payment_id'],
                signature: $validated['razorpay_signature'] ?? null
            );

            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Razorpay Server-to-Server Webhook
     */
    public function razorpayWebhook(Request $request): JsonResponse
    {
        $payload = $request->all();
        $signature = $request->header('X-Razorpay-Signature');

        $handled = $this->visitorPassService->handleWebhook($payload, $signature);

        return response()->json(['status' => $handled ? 'success' : 'ignored']);
    }

    /**
     * Authenticated Staff/Turnstile Endpoint: Scan Member Pass QR
     */
    public function scanMemberPass(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pass_payload' => ['required', 'string'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $gymId = CurrentGym::require();
        $payloadRaw = trim($validated['pass_payload']);

        // Check if JSON payload (from new rich pass QR)
        $memberCode = $payloadRaw;
        if (str_starts_with($payloadRaw, '{') && str_ends_with($payloadRaw, '}')) {
            $decoded = json_decode($payloadRaw, true);
            if (isset($decoded['code'])) {
                $memberCode = $decoded['code'];
            }
        } elseif (str_starts_with($payloadRaw, 'MEM:')) {
            $memberCode = substr($payloadRaw, 4);
        }

        $member = Member::with(['activeMembership.plan', 'primaryBranch'])
            ->where('gym_id', $gymId)
            ->where(function ($q) use ($memberCode) {
                $q->where('member_code', $memberCode)
                  ->orWhere('phone', $memberCode)
                  ->orWhere('id', is_numeric($memberCode) ? (int)$memberCode : 0);
            })
            ->first();

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Unrecognized member QR pass.',
            ], 404);
        }

        $activeMembership = $member->activeMembership;
        if (!$activeMembership || ($activeMembership->end_date && $activeMembership->end_date->isPast())) {
            return response()->json([
                'success' => false,
                'message' => "Member {$member->full_name} has an expired membership.",
                'member' => $member,
            ], 422);
        }

        if ($activeMembership->status === 'frozen') {
            return response()->json([
                'success' => false,
                'message' => "Membership is frozen.",
                'member' => $member,
            ], 422);
        }

        $branchId = $validated['branch_id'] ?? $member->primary_branch_id;

        // Check duplicate check-in today
        $already = AttendanceLog::where('member_id', $member->id)
            ->whereDate('check_in_at', now()->toDateString())
            ->whereNull('check_out_at')
            ->first();

        if ($already) {
            return response()->json([
                'success' => true,
                'already_checked_in' => true,
                'message' => "{$member->full_name} already checked in at {$already->check_in_at->format('h:i A')}.",
                'member' => $member,
            ]);
        }

        $log = AttendanceLog::create([
            'gym_id' => $gymId,
            'branch_id' => $branchId,
            'member_id' => $member->id,
            'person_type' => 'member',
            'check_in_at' => now(),
            'method' => 'turnstile_qr',
            'qr_reference' => $member->member_code,
            'verified_by_user_id' => $request->user()?->id,
            'notes' => "Scanner check-in by staff",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Check-in recorded for {$member->full_name}.",
            'log' => $log,
            'member' => $member,
        ], 201);
    }
}
