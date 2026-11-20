<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Member;
use App\Models\MemberDietPlan;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class DietPlanController extends Controller
{
    protected function checkFitnessAccess(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if ($user && in_array($user->role, ['receptionist', 'front_desk', 'accountant', 'inventory_manager'], true)) {
            return response()->json([
                'message' => 'Unauthorized: Receptionist and front desk staff are not permitted to access private fitness and health data.',
            ], 403);
        }
        return null;
    }

    /**
     * List member diet plans.
     */
    public function index(Request $request)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $user = $request->user();

        $query = MemberDietPlan::with([
            'member:id,first_name,last_name,phone,member_code,status',
            'trainer:id,name,phone,specialization',
            'branch:id,name',
        ]);

        if ($request->filled('member_id')) {
            $query->where('member_id', $request->query('member_id'));
        }

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }

        if ($user->role === 'trainer') {
            $query->where(function ($q) use ($user) {
                $q->where('trainer_id', $user->id)
                  ->orWhereHas('member', function ($mq) use ($user) {
                      $mq->where('assigned_trainer_id', $user->id);
                  });
            });
        }

        $plans = $query->latest('id')->paginate(20);

        return response()->json($plans);
    }

    /**
     * Store new diet plan.
     */
    public function store(Request $request)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $user = $request->user();

        $validated = $request->validate([
            'member_id' => 'required|exists:members,id',
            'title' => 'required|string|max:150',
            'goal' => 'required|string|max:60',
            'dietary_preference' => 'required|string|in:vegetarian,non_vegetarian,vegan,eggetarian',
            'food_allergies' => 'nullable|string',
            'food_preferences' => 'nullable|string',
            'target_calories' => 'nullable|integer|min:800|max:8000',
            'target_protein_g' => 'nullable|integer|min:20|max:500',
            'target_carbs_g' => 'nullable|integer|min:20|max:1000',
            'target_fat_g' => 'nullable|integer|min:10|max:400',
            'meals' => 'required|array|min:1',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'status' => 'nullable|string|in:draft,active,paused,completed',
        ]);

        $member = Member::findOrFail($validated['member_id']);
        $trainerId = ($user->role === 'trainer') ? $user->id : ($member->assigned_trainer_id ?: $user->id);

        // Calculate macro sums if targets were left empty
        $calculatedCalories = 0;
        $calculatedProtein = 0;
        $calculatedCarbs = 0;
        $calculatedFat = 0;

        foreach ($validated['meals'] as $mealSlot) {
            foreach ($mealSlot['items'] ?? [] as $item) {
                $calculatedCalories += (float) ($item['calories'] ?? 0);
                $calculatedProtein += (float) ($item['protein'] ?? 0);
                $calculatedCarbs += (float) ($item['carbs'] ?? 0);
                $calculatedFat += (float) ($item['fat'] ?? 0);
            }
        }

        $targetCalories = !empty($validated['target_calories']) ? $validated['target_calories'] : round($calculatedCalories);
        $targetProtein = !empty($validated['target_protein_g']) ? $validated['target_protein_g'] : round($calculatedProtein);
        $targetCarbs = !empty($validated['target_carbs_g']) ? $validated['target_carbs_g'] : round($calculatedCarbs);
        $targetFat = !empty($validated['target_fat_g']) ? $validated['target_fat_g'] : round($calculatedFat);

        if (($validated['status'] ?? 'active') === 'active') {
            MemberDietPlan::where('member_id', $member->id)
                ->where('status', 'active')
                ->update(['status' => 'archived']);
        }

        $plan = MemberDietPlan::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $member->primary_branch_id,
            'member_id' => $member->id,
            'trainer_id' => $trainerId,
            'title' => $validated['title'],
            'goal' => $validated['goal'],
            'dietary_preference' => $validated['dietary_preference'],
            'food_allergies' => $validated['food_allergies'] ?? null,
            'food_preferences' => $validated['food_preferences'] ?? null,
            'target_calories' => $targetCalories,
            'target_protein_g' => $targetProtein,
            'target_carbs_g' => $targetCarbs,
            'target_fat_g' => $targetFat,
            'meals' => $validated['meals'],
            'start_date' => $validated['start_date'] ?? now()->toDateString(),
            'end_date' => $validated['end_date'] ?? now()->addMonths(2)->toDateString(),
            'notes' => $validated['notes'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'version' => 1,
        ]);

        AuditLog::record('diet_plan.created', [
            'plan_id' => $plan->id,
            'member_id' => $member->id,
            'trainer_id' => $trainerId,
            'title' => $plan->title,
        ]);

        return response()->json([
            'message' => "Diet & Nutrition plan '{$plan->title}' successfully assigned to {$member->full_name}",
            'diet_plan' => $plan->load(['member:id,first_name,last_name', 'trainer:id,name']),
        ], 201);
    }

    /**
     * Show diet plan details.
     */
    public function show(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $plan = MemberDietPlan::with([
            'member:id,first_name,last_name,phone,member_code,status,avatar_url',
            'trainer:id,name,phone,specialization',
            'branch:id,name',
            'parentPlan:id,title,version,created_at',
            'revisions:id,title,version,created_at,status',
            'mealLogs' => function ($q) {
                $q->latest('log_date')->take(20);
            },
        ])->findOrFail($id);

        return response()->json([
            'diet_plan' => $plan,
        ]);
    }

    /**
     * Update diet plan with version history.
     */
    public function update(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $user = $request->user();

        $existing = MemberDietPlan::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:150',
            'goal' => 'required|string|max:60',
            'dietary_preference' => 'required|string|in:vegetarian,non_vegetarian,vegan,eggetarian',
            'food_allergies' => 'nullable|string',
            'food_preferences' => 'nullable|string',
            'target_calories' => 'nullable|integer',
            'target_protein_g' => 'nullable|integer',
            'target_carbs_g' => 'nullable|integer',
            'target_fat_g' => 'nullable|integer',
            'meals' => 'required|array|min:1',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'status' => 'nullable|string|in:draft,active,paused,completed,archived',
        ]);

        // If plan was already active, preserve previous version
        if ($existing->status === 'active') {
            $existing->update(['status' => 'archived']);

            $newVersion = MemberDietPlan::create([
                'gym_id' => $existing->gym_id,
                'branch_id' => $existing->branch_id,
                'member_id' => $existing->member_id,
                'trainer_id' => $user->id,
                'title' => $validated['title'],
                'goal' => $validated['goal'],
                'dietary_preference' => $validated['dietary_preference'],
                'food_allergies' => $validated['food_allergies'] ?? null,
                'food_preferences' => $validated['food_preferences'] ?? null,
                'target_calories' => $validated['target_calories'] ?? $existing->target_calories,
                'target_protein_g' => $validated['target_protein_g'] ?? $existing->target_protein_g,
                'target_carbs_g' => $validated['target_carbs_g'] ?? $existing->target_carbs_g,
                'target_fat_g' => $validated['target_fat_g'] ?? $existing->target_fat_g,
                'meals' => $validated['meals'],
                'start_date' => $validated['start_date'] ?? now()->toDateString(),
                'end_date' => $validated['end_date'] ?? $existing->end_date,
                'notes' => $validated['notes'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'version' => $existing->version + 1,
                'parent_plan_id' => $existing->id,
            ]);

            AuditLog::record('diet_plan.version_created', [
                'old_plan_id' => $existing->id,
                'new_plan_id' => $newVersion->id,
                'version' => $newVersion->version,
            ]);

            return response()->json([
                'message' => "New version v{$newVersion->version} created and published successfully",
                'diet_plan' => $newVersion->load(['member', 'trainer']),
            ]);
        }

        $existing->update($validated);

        return response()->json([
            'message' => 'Diet plan updated successfully',
            'diet_plan' => $existing->fresh(['member', 'trainer']),
        ]);
    }

    /**
     * Duplicate diet plan.
     */
    public function duplicate(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $plan = MemberDietPlan::findOrFail($id);

        $copy = $plan->replicate(['id', 'created_at', 'updated_at']);
        $copy->title = $plan->title . ' (Copy)';
        $copy->status = 'draft';
        $copy->version = 1;
        $copy->parent_plan_id = null;
        $copy->save();

        return response()->json([
            'message' => 'Diet plan duplicated as draft',
            'diet_plan' => $copy,
        ], 201);
    }

    /**
     * Update diet plan status.
     */
    public function updateStatus(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $plan = MemberDietPlan::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:draft,active,paused,completed,archived',
        ]);

        if ($validated['status'] === 'active') {
            MemberDietPlan::where('member_id', $plan->member_id)
                ->where('id', '!=', $plan->id)
                ->where('status', 'active')
                ->update(['status' => 'archived']);
        }

        $plan->update(['status' => $validated['status']]);

        return response()->json([
            'message' => "Diet plan status updated to '{$validated['status']}'",
            'diet_plan' => $plan,
        ]);
    }
}
