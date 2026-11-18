<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $query = Lead::with([
            'branch:id,name,code',
            'assignedStaff:id,name',
            'interestedPlan:id,name,price',
            'convertedMember:id,member_code,first_name,last_name',
            'followups' => fn ($q) => $q->latest('followup_date')->take(5),
        ]);

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('source')) {
            $query->where('source', $request->input('source'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('phone', 'like', $search)
                  ->orWhere('email', 'like', $search);
            });
        }

        $leads = $query->latest('id')->paginate($request->input('per_page', 20));

        // Pipeline stats
        $countsQuery = Lead::query();
        if ($branchId) $countsQuery->where('branch_id', $branchId);

        $counts = (clone $countsQuery)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $totalLeads = (clone $countsQuery)->count();
        $converted = $counts['converted'] ?? 0;
        $conversionRate = $totalLeads > 0 ? round(($converted / $totalLeads) * 100, 1) : 0;

        return response()->json([
            'leads' => $leads,
            'pipeline' => [
                'total' => $totalLeads,
                'new' => $counts['new'] ?? 0,
                'contacted' => $counts['contacted'] ?? 0,
                'trial_booked' => $counts['trial_booked'] ?? 0,
                'converted' => $converted,
                'lost' => $counts['lost'] ?? 0,
                'conversion_rate_percent' => $conversionRate,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'gender' => ['nullable', 'in:male,female,other'],
            'source' => ['required', 'in:walk_in,instagram,google,referral,website,phone_enquiry,other'],
            'fitness_goal' => ['nullable', 'in:weight_loss,muscle_gain,general_fitness,bodybuilding,personal_training,other'],
            'interested_plan_id' => ['nullable', 'exists:membership_plans,id'],
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'followup_date' => ['nullable', 'date'],
            'trial_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'exists:branches,id'],
        ]);

        $branchId = $validated['branch_id'] ?? CurrentBranch::id();
        if (!$branchId) {
            $branch = Branch::where('is_primary', true)->first() ?? Branch::firstOrFail();
            $branchId = $branch->id;
        }

        $lead = Lead::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $branchId,
            'name' => $validated['name'],
            'phone' => preg_replace('/\D/', '', $validated['phone']),
            'email' => $validated['email'] ?? null,
            'gender' => $validated['gender'] ?? 'other',
            'source' => $validated['source'],
            'fitness_goal' => $validated['fitness_goal'] ?? 'general_fitness',
            'interested_plan_id' => $validated['interested_plan_id'] ?? null,
            'assigned_user_id' => $validated['assigned_user_id'] ?? $request->user()->id,
            'status' => !empty($validated['trial_date']) ? 'trial_booked' : 'new',
            'followup_date' => $validated['followup_date'] ?? now()->addDays(2)->toDateString(),
            'trial_date' => $validated['trial_date'] ?? null,
            'trial_status' => !empty($validated['trial_date']) ? 'pending' : null,
            'notes' => $validated['notes'] ?? null,
        ]);

        AuditLog::record('lead.created', ['lead_id' => $lead->id, 'name' => $lead->name], $branchId);

        return response()->json($lead->load(['branch', 'assignedStaff', 'interestedPlan']), 201);
    }

    public function show(int $id)
    {
        $lead = Lead::with([
            'branch',
            'assignedStaff',
            'interestedPlan',
            'convertedMember',
            'followups.user:id,name',
        ])->findOrFail($id);

        return response()->json($lead);
    }

    public function logFollowup(Request $request, int $id)
    {
        $lead = Lead::findOrFail($id);

        $validated = $request->validate([
            'type' => ['required', 'in:call,whatsapp,in_person,email'],
            'summary' => ['required', 'string'],
            'next_followup_date' => ['nullable', 'date'],
            'update_status' => ['nullable', 'in:contacted,trial_booked,lost'],
        ]);

        $followup = LeadFollowup::create([
            'gym_id' => CurrentGym::require(),
            'lead_id' => $lead->id,
            'user_id' => $request->user()->id,
            'followup_date' => now()->toDateString(),
            'type' => $validated['type'],
            'summary' => $validated['summary'],
            'next_followup_date' => $validated['next_followup_date'] ?? null,
        ]);

        $updates = [
            'followup_date' => $validated['next_followup_date'] ?? $lead->followup_date,
        ];

        if (!empty($validated['update_status'])) {
            $updates['status'] = $validated['update_status'];
        } elseif ($lead->status === 'new') {
            $updates['status'] = 'contacted';
        }

        $lead->update($updates);

        return response()->json([
            'message' => 'Follow-up logged successfully.',
            'lead' => $lead->fresh(['followups.user', 'assignedStaff']),
            'followup' => $followup,
        ]);
    }

    public function addFollowup(Request $request, int $id)
    {
        return $this->logFollowup($request, $id);
    }

    public function bookTrial(Request $request, int $id)
    {
        $lead = Lead::findOrFail($id);

        $validated = $request->validate([
            'trial_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $lead->update([
            'trial_date' => $validated['trial_date'],
            'trial_status' => 'pending',
            'status' => 'trial_booked',
            'notes' => $validated['notes'] ? ($lead->notes . "\n" . $validated['notes']) : $lead->notes,
        ]);

        return response()->json(['message' => 'Trial booked successfully.', 'lead' => $lead]);
    }

    /**
     * 1-Click Convert Lead into Registered Member.
     */
    public function convert(Request $request, int $id)
    {
        $lead = Lead::findOrFail($id);

        if ($lead->status === 'converted') {
            return response()->json(['message' => 'Lead is already converted.'], 422);
        }

        $validated = $request->validate([
            'membership_plan_id' => ['nullable', 'exists:membership_plans,id'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:cash,upi,card,bank_transfer,cheque'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        return DB::transaction(function () use ($lead, $validated, $request) {
            $branchId = $lead->branch_id;

            // Generate Member Code
            $lastMember = Member::latest('id')->first();
            $nextSeq = $lastMember ? ($lastMember->id + 1) : 1;
            $memberCode = 'MEM-' . str_pad((string) $nextSeq, 4, '0', STR_PAD_LEFT);

            // Split name into first & last
            $parts = explode(' ', trim($lead->name), 2);
            $firstName = $parts[0];
            $lastName = $parts[1] ?? null;

            $member = Member::create([
                'primary_branch_id' => $branchId,
                'member_code' => $memberCode,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $lead->email,
                'phone' => $lead->phone,
                'gender' => $lead->gender ?? 'other',
                'status' => 'active',
                'joined_date' => now()->toDateString(),
                'notes' => 'Converted from Lead ID #' . $lead->id . ($lead->notes ? " — " . $lead->notes : ''),
            ]);

            // Optional membership subscription & payment
            if (!empty($validated['membership_plan_id'])) {
                $plan = MembershipPlan::findOrFail($validated['membership_plan_id']);
                $totalPrice = (float) $plan->price;
                $discount = (float) ($validated['discount_amount'] ?? 0);
                $finalPrice = max(0, $totalPrice - $discount);
                $paidAmount = (float) ($validated['paid_amount'] ?? 0);
                $balanceDue = max(0, $finalPrice - $paidAmount);

                $membership = MemberMembership::create([
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'membership_plan_id' => $plan->id,
                    'start_date' => now()->toDateString(),
                    'end_date' => now()->addDays($plan->duration_days)->toDateString(),
                    'status' => 'active',
                    'category' => $plan->category,
                    'total_price' => $totalPrice,
                    'discount_amount' => $discount,
                    'final_price' => $finalPrice,
                    'price_paid' => $paidAmount,
                    'balance_due' => $balanceDue,
                    'total_pt_sessions' => $plan->pt_sessions_count,
                ]);

                if ($paidAmount > 0) {
                    Payment::create([
                        'branch_id' => $branchId,
                        'member_id' => $member->id,
                        'member_membership_id' => $membership->id,
                        'receipt_number' => 'REC-' . date('Y') . '-' . str_pad((string) (Payment::max('id') + 1), 5, '0', STR_PAD_LEFT),
                        'type' => 'payment',
                        'amount' => $paidAmount,
                        'discount_amount' => $discount,
                        'balance_after_payment' => $balanceDue,
                        'payment_method' => $validated['payment_method'] ?? 'cash',
                        'payment_date' => now()->toDateString(),
                        'status' => 'completed',
                        'collected_by_user_id' => $request->user()->id,
                    ]);
                }

                $member->recalculateBalances();
            }

            // Mark lead as converted
            $lead->update([
                'status' => 'converted',
                'converted_member_id' => $member->id,
                'converted_at' => now(),
            ]);

            AuditLog::record('lead.converted', [
                'lead_id' => $lead->id,
                'member_id' => $member->id,
                'member_code' => $member->member_code,
            ], $branchId);

            return response()->json([
                'message' => "Lead converted successfully! Member {$member->full_name} ({$member->member_code}) created.",
                'member' => $member->load(['primaryBranch', 'activeMembership.plan']),
                'lead' => $lead->fresh(),
            ]);
        });
    }

    public function markLost(Request $request, int $id)
    {
        $lead = Lead::findOrFail($id);

        $validated = $request->validate([
            'lost_reason' => ['required', 'in:too_expensive,joined_another_gym,distance_location,no_response,timing_issue,other'],
            'notes' => ['nullable', 'string'],
        ]);

        $lead->update([
            'status' => 'lost',
            'lost_reason' => $validated['lost_reason'],
            'notes' => $validated['notes'] ? ($lead->notes . "\nLost note: " . $validated['notes']) : $lead->notes,
        ]);

        return response()->json(['message' => 'Lead marked as lost.', 'lead' => $lead]);
    }
}
