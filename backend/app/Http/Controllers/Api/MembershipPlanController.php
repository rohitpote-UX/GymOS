<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MembershipPlan;
use App\Support\CurrentBranch;
use Illuminate\Http\Request;

class MembershipPlanController extends Controller
{
    public function index(Request $request)
    {
        $query = MembershipPlan::with('branch:id,name,code')
            ->withCount('memberMemberships');

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where(function ($q) use ($branchId) {
                $q->whereNull('branch_id')->orWhere('branch_id', $branchId);
            });
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('plan_type')) {
            $query->where('plan_type', $request->input('plan_type'));
        }

        $plans = $query->orderBy('duration_days')->get();

        return response()->json($plans);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:30'],
            'category' => ['nullable', 'string', 'in:monthly,quarterly,half_yearly,annual,custom,pt_package,trial,day_pass,corporate,family'],
            'plan_type' => ['nullable', 'string', 'in:regular,pt,trial,day_pass'],
            'duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'price' => ['required', 'numeric', 'min:0'],
            'admission_fee' => ['nullable', 'numeric', 'min:0'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pt_sessions_count' => ['nullable', 'integer', 'min:0'],
            'max_freeze_days' => ['nullable', 'integer', 'min:0'],
            'description' => ['nullable', 'string'],
            'features' => ['nullable', 'array'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['category'] = $validated['category'] ?? 'monthly';
        $validated['plan_type'] = $validated['plan_type'] ?? 'regular';

        $plan = MembershipPlan::create($validated);

        AuditLog::record('membership_plan.created', ['plan_id' => $plan->id, 'name' => $plan->name], $plan->branch_id);

        return response()->json($plan->load('branch'), 201);
    }

    public function show(int $id)
    {
        $plan = MembershipPlan::with('branch')->withCount('memberMemberships')->findOrFail($id);

        return response()->json($plan);
    }

    public function update(Request $request, int $id)
    {
        $plan = MembershipPlan::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:30'],
            'category' => ['nullable', 'string', 'in:monthly,quarterly,half_yearly,annual,custom,pt_package,trial,day_pass,corporate,family'],
            'plan_type' => ['nullable', 'string', 'in:regular,pt,trial,day_pass'],
            'duration_days' => ['sometimes', 'integer', 'min:1'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'admission_fee' => ['nullable', 'numeric', 'min:0'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pt_sessions_count' => ['nullable', 'integer', 'min:0'],
            'max_freeze_days' => ['nullable', 'integer', 'min:0'],
            'description' => ['nullable', 'string'],
            'features' => ['nullable', 'array'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $plan->update($validated);

        AuditLog::record('membership_plan.updated', ['plan_id' => $plan->id], $plan->branch_id);

        return response()->json($plan->fresh('branch'));
    }

    public function destroy(int $id)
    {
        $plan = MembershipPlan::findOrFail($id);
        $plan->delete();

        AuditLog::record('membership_plan.deleted', ['plan_id' => $plan->id, 'name' => $plan->name], $plan->branch_id);

        return response()->json(['message' => 'Membership plan deleted successfully.']);
    }
}
