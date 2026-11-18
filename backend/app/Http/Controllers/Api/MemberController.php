<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MemberController extends Controller
{
    public function index(Request $request)
    {
        $query = Member::with(['primaryBranch:id,name,code', 'activeMembership.plan', 'trainer:id,name,phone'])
            ->withCount(['payments', 'attendance']);

        // Branch filter: either explicitly requested or default to current branch context
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('primary_branch_id', $branchId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('trainer_id')) {
            $query->where('assigned_trainer_id', $request->input('trainer_id'));
        }

        if ($request->filled('has_due') && $request->boolean('has_due')) {
            $query->where('outstanding_balance', '>', 0);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', $search)
                  ->orWhere('last_name', 'like', $search)
                  ->orWhere('phone', 'like', $search)
                  ->orWhere('member_code', 'like', $search)
                  ->orWhere('email', 'like', $search);
            });
        }

        $members = $query->latest()->paginate($request->input('per_page', 20));

        return response()->json($members);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['nullable', 'string', 'max:80'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'gender' => ['nullable', 'in:male,female,other'],
            'dob' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'emergency_contact_name' => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'primary_branch_id' => ['nullable', 'exists:branches,id'],
            'assigned_trainer_id' => ['nullable', 'exists:users,id'],
            'joined_date' => ['nullable', 'date'],
            'photo_data' => ['nullable', 'string'],
            'avatar_url' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            // Optional immediate membership plan enrolment
            'membership_plan_id' => ['nullable', 'exists:membership_plans,id'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:cash,upi,card,bank_transfer,cheque'],
            'client_uuid' => ['nullable', 'uuid'],
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $branchId = $validated['primary_branch_id'] ?? CurrentBranch::id();
            if (!$branchId) {
                $branch = Branch::where('is_primary', true)->first() ?? Branch::firstOrFail();
                $branchId = $branch->id;
            }

            // Auto-generate member code if not supplied: MEM-0001, MEM-0002...
            $lastMember = Member::latest('id')->first();
            $nextNumber = $lastMember ? ($lastMember->id + 1) : 1;
            $memberCode = 'MEM-' . str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);

            $member = Member::create([
                'gym_id' => CurrentGym::require(),
                'primary_branch_id' => $branchId,
                'assigned_trainer_id' => $validated['assigned_trainer_id'] ?? null,
                'member_code' => $memberCode,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'] ?? null,
                'email' => $validated['email'] ?? null,
                'phone' => preg_replace('/\D/', '', $validated['phone']),
                'gender' => $validated['gender'] ?? 'other',
                'dob' => $validated['dob'] ?? null,
                'address' => $validated['address'] ?? null,
                'emergency_contact_name' => $validated['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $validated['emergency_contact_phone'] ?? null,
                'blood_group' => $validated['blood_group'] ?? null,
                'status' => 'active',
                'joined_date' => $validated['joined_date'] ?? now()->toDateString(),
                'photo_data' => $validated['photo_data'] ?? null,
                'avatar_url' => $validated['avatar_url'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'total_fees_billed' => 0,
                'total_fees_paid' => 0,
                'outstanding_balance' => 0,
            ]);

            // If a membership plan was selected, create membership & ledger & payment
            if (!empty($validated['membership_plan_id'])) {
                $plan = MembershipPlan::findOrFail($validated['membership_plan_id']);
                $startDate = now();
                $endDate = now()->addDays($plan->duration_days);

                $totalPrice = (float) $plan->price;
                $discount = (float) ($validated['discount_amount'] ?? 0);
                $finalPrice = max(0, $totalPrice - $discount);
                $paidAmount = (float) ($validated['paid_amount'] ?? 0);
                $balanceDue = max(0, $finalPrice - $paidAmount);

                $membership = MemberMembership::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'membership_plan_id' => $plan->id,
                    'assigned_trainer_id' => $member->assigned_trainer_id,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'status' => 'active',
                    'category' => $plan->category ?? 'monthly',
                    'total_price' => $totalPrice,
                    'discount_amount' => $discount,
                    'final_price' => $finalPrice,
                    'price_paid' => $paidAmount,
                    'balance_due' => $balanceDue,
                    'total_pt_sessions' => $plan->pt_sessions_count ?? 0,
                    'completed_pt_sessions' => 0,
                ]);

                // Create initial ledger charge
                MemberLedger::create([
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'type' => 'charge',
                    'reference_type' => 'membership',
                    'reference_id' => $membership->id,
                    'description' => "Initial Enrolment: {$plan->name}",
                    'debit' => $finalPrice,
                    'credit' => 0,
                    'running_balance' => $finalPrice,
                    'transaction_date' => now()->toDateString(),
                    'created_by_user_id' => $request->user()->id,
                ]);

                if ($paidAmount > 0) {
                    $lastPayment = Payment::latest('id')->first();
                    $receiptNumber = 'REC-' . date('Y') . '-' . str_pad((string) (($lastPayment?->id ?? 0) + 1), 5, '0', STR_PAD_LEFT);

                    $payment = Payment::create([
                        'gym_id' => CurrentGym::require(),
                        'branch_id' => $branchId,
                        'member_id' => $member->id,
                        'member_membership_id' => $membership->id,
                        'receipt_number' => $receiptNumber,
                        'type' => 'payment',
                        'client_uuid' => $validated['client_uuid'] ?? null,
                        'amount' => $paidAmount,
                        'discount_amount' => $discount,
                        'balance_after_payment' => $balanceDue,
                        'payment_method' => $validated['payment_method'] ?? 'cash',
                        'payment_date' => now()->toDateString(),
                        'status' => 'completed',
                        'collected_by_user_id' => $request->user()->id,
                    ]);

                    MemberLedger::create([
                        'gym_id' => CurrentGym::require(),
                        'branch_id' => $branchId,
                        'member_id' => $member->id,
                        'type' => 'payment',
                        'reference_type' => 'payment',
                        'reference_id' => $payment->id,
                        'description' => "Payment #{$receiptNumber} via " . strtoupper($validated['payment_method'] ?? 'cash'),
                        'debit' => 0,
                        'credit' => $paidAmount,
                        'running_balance' => $balanceDue,
                        'transaction_date' => now()->toDateString(),
                        'created_by_user_id' => $request->user()->id,
                    ]);
                }

                $member->recalculateBalances();
            }

            AuditLog::record('member.registered', [
                'member_id' => $member->id,
                'member_code' => $member->member_code,
                'name' => $member->full_name,
            ], $branchId);

            return response()->json($member->load(['primaryBranch', 'activeMembership.plan', 'trainer']), 201);
        });
    }

    public function show(int $id)
    {
        $member = Member::with([
            'primaryBranch:id,name,code',
            'trainer:id,name,phone,specialization,avatar_url',
            'memberships.plan',
            'memberships.freezes',
            'memberships.trainer:id,name',
            'payments.collector:id,name',
            'attendance' => fn ($q) => $q->latest('check_in_at')->take(30),
            'attendance.branch:id,name',
            'ledger' => fn ($q) => $q->latest('id')->take(50),
            'ptSessions' => fn ($q) => $q->latest('scheduled_at')->take(20),
            'ptSessions.trainer:id,name',
            'posOrders' => fn ($q) => $q->with(['items.product:id,name,brand,sku', 'refunds'])->latest('order_date')->take(20),
        ])->findOrFail($id);

        return response()->json($member);
    }

    public function update(Request $request, int $id)
    {
        $member = Member::findOrFail($id);

        $validated = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:80'],
            'last_name' => ['nullable', 'string', 'max:80'],
            'phone' => ['sometimes', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'gender' => ['nullable', 'in:male,female,other'],
            'dob' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'emergency_contact_name' => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'primary_branch_id' => ['sometimes', 'exists:branches,id'],
            'assigned_trainer_id' => ['nullable', 'exists:users,id'],
            'status' => ['sometimes', 'in:active,inactive,expired,frozen'],
            'photo_data' => ['nullable', 'string'],
            'avatar_url' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        if (isset($validated['phone'])) {
            $validated['phone'] = preg_replace('/\D/', '', $validated['phone']);
        }

        $member->update($validated);
        $member->recalculateBalances();

        AuditLog::record('member.updated', ['member_id' => $member->id], $member->primary_branch_id);

        return response()->json($member->fresh(['primaryBranch', 'activeMembership.plan', 'trainer']));
    }

    public function updatePhoto(Request $request, int $id)
    {
        $member = Member::findOrFail($id);

        $validated = $request->validate([
            'photo_data' => ['required', 'string'],
        ]);

        $member->update([
            'photo_data' => $validated['photo_data'],
        ]);

        AuditLog::record('member.photo_updated', ['member_id' => $member->id], $member->primary_branch_id);

        return response()->json([
            'message' => 'Member photograph updated successfully.',
            'member' => $member->fresh(),
        ]);
    }

    public function qrCode(int $id)
    {
        $member = Member::with(['activeMembership.plan', 'primaryBranch'])->findOrFail($id);

        return response()->json([
            'member_id' => $member->id,
            'member_code' => $member->member_code,
            'full_name' => $member->full_name,
            'phone' => $member->phone,
            'branch' => $member->primaryBranch?->name,
            'status' => $member->status,
            'has_active_membership' => (bool) $member->activeMembership,
            'active_plan' => $member->activeMembership?->plan?->name,
            'expires_on' => $member->activeMembership?->end_date?->toDateString(),
            'outstanding_balance' => (float) $member->outstanding_balance,
            'qr_payload' => json_encode([
                'id' => $member->id,
                'code' => $member->member_code,
                'gym_id' => $member->gym_id,
            ]),
        ]);
    }

    public function destroy(int $id)
    {
        $member = Member::findOrFail($id);
        $member->delete();

        AuditLog::record('member.deleted', ['member_id' => $member->id, 'name' => $member->full_name], $member->primary_branch_id);

        return response()->json(['message' => 'Member deleted successfully.']);
    }
}
