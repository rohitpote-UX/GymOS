<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Member;
use App\Models\MemberWorkoutPlan;
use App\Models\WorkoutTemplate;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class WorkoutPlanController extends Controller
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
     * List workout plans with filters.
     */
    public function index(Request $request)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $user = $request->user();

        $query = MemberWorkoutPlan::with([
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

        // If trainer, default to their assigned members or their created plans unless requested otherwise
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
     * Store new workout plan for a member.
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
            'difficulty' => 'required|string|in:beginner,intermediate,advanced',
            'days_per_week' => 'required|integer|min:1|max:7',
            'schedule' => 'required|array|min:1',
            'notes' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'status' => 'nullable|string|in:draft,active,paused,completed',
        ]);

        $member = Member::findOrFail($validated['member_id']);
        $trainerId = ($user->role === 'trainer') ? $user->id : ($member->assigned_trainer_id ?: $user->id);

        // If newly created plan is active, deactivate/archive any previous active plans for this member
        if (($validated['status'] ?? 'active') === 'active') {
            MemberWorkoutPlan::where('member_id', $member->id)
                ->where('status', 'active')
                ->update(['status' => 'archived', 'is_active' => false]);
        }

        $plan = MemberWorkoutPlan::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $member->primary_branch_id,
            'member_id' => $member->id,
            'trainer_id' => $trainerId,
            'title' => $validated['title'],
            'goal' => $validated['goal'],
            'difficulty' => $validated['difficulty'],
            'days_per_week' => $validated['days_per_week'],
            'exercises' => $validated['schedule'], // backward-compatibility
            'schedule' => $validated['schedule'],
            'notes' => $validated['notes'] ?? null,
            'start_date' => $validated['start_date'] ?? now()->toDateString(),
            'end_date' => $validated['end_date'] ?? now()->addMonths(2)->toDateString(),
            'status' => $validated['status'] ?? 'active',
            'is_active' => ($validated['status'] ?? 'active') === 'active',
            'version' => 1,
        ]);

        AuditLog::record('workout_plan.created', [
            'plan_id' => $plan->id,
            'member_id' => $member->id,
            'trainer_id' => $trainerId,
            'title' => $plan->title,
        ]);

        return response()->json([
            'message' => "Workout routine '{$plan->title}' successfully assigned to {$member->full_name}",
            'workout_plan' => $plan->load(['member:id,first_name,last_name', 'trainer:id,name']),
        ], 201);
    }

    /**
     * Show workout plan details.
     */
    public function show(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $plan = MemberWorkoutPlan::with([
            'member:id,first_name,last_name,phone,member_code,status,avatar_url',
            'trainer:id,name,phone,specialization',
            'branch:id,name',
            'parentPlan:id,title,version,created_at',
            'revisions:id,title,version,created_at,status',
            'sessions' => function ($q) {
                $q->latest('session_date')->take(10);
            },
        ])->findOrFail($id);

        return response()->json([
            'workout_plan' => $plan,
        ]);
    }

    /**
     * Update workout plan with version history preservation.
     */
    public function update(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $user = $request->user();

        $existingPlan = MemberWorkoutPlan::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:150',
            'goal' => 'required|string|max:60',
            'difficulty' => 'required|string|in:beginner,intermediate,advanced',
            'days_per_week' => 'required|integer|min:1|max:7',
            'schedule' => 'required|array|min:1',
            'notes' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'status' => 'nullable|string|in:draft,active,paused,completed,archived',
        ]);

        // If plan was already active and being modified, create a new version to preserve historical audit trail!
        if ($existingPlan->status === 'active') {
            $existingPlan->update(['status' => 'archived', 'is_active' => false]);

            $newVersion = MemberWorkoutPlan::create([
                'gym_id' => $existingPlan->gym_id,
                'branch_id' => $existingPlan->branch_id,
                'member_id' => $existingPlan->member_id,
                'trainer_id' => $user->id,
                'title' => $validated['title'],
                'goal' => $validated['goal'],
                'difficulty' => $validated['difficulty'],
                'days_per_week' => $validated['days_per_week'],
                'exercises' => $validated['schedule'],
                'schedule' => $validated['schedule'],
                'notes' => $validated['notes'] ?? null,
                'start_date' => $validated['start_date'] ?? now()->toDateString(),
                'end_date' => $validated['end_date'] ?? $existingPlan->end_date,
                'status' => $validated['status'] ?? 'active',
                'is_active' => ($validated['status'] ?? 'active') === 'active',
                'version' => $existingPlan->version + 1,
                'parent_plan_id' => $existingPlan->id,
            ]);

            AuditLog::record('workout_plan.version_created', [
                'old_plan_id' => $existingPlan->id,
                'new_plan_id' => $newVersion->id,
                'version' => $newVersion->version,
            ]);

            return response()->json([
                'message' => "New version v{$newVersion->version} created and published successfully",
                'workout_plan' => $newVersion->load(['member', 'trainer']),
            ]);
        }

        // If draft, update directly
        $existingPlan->update([
            'title' => $validated['title'],
            'goal' => $validated['goal'],
            'difficulty' => $validated['difficulty'],
            'days_per_week' => $validated['days_per_week'],
            'exercises' => $validated['schedule'],
            'schedule' => $validated['schedule'],
            'notes' => $validated['notes'] ?? $existingPlan->notes,
            'start_date' => $validated['start_date'] ?? $existingPlan->start_date,
            'end_date' => $validated['end_date'] ?? $existingPlan->end_date,
            'status' => $validated['status'] ?? $existingPlan->status,
            'is_active' => ($validated['status'] ?? $existingPlan->status) === 'active',
        ]);

        return response()->json([
            'message' => 'Workout plan updated successfully',
            'workout_plan' => $existingPlan->fresh(['member', 'trainer']),
        ]);
    }

    /**
     * Duplicate workout plan.
     */
    public function duplicate(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $plan = MemberWorkoutPlan::findOrFail($id);

        $copy = $plan->replicate(['id', 'created_at', 'updated_at']);
        $copy->title = $plan->title . ' (Copy)';
        $copy->status = 'draft';
        $copy->is_active = false;
        $copy->version = 1;
        $copy->parent_plan_id = null;
        $copy->save();

        return response()->json([
            'message' => 'Workout plan duplicated as draft',
            'workout_plan' => $copy,
        ], 201);
    }

    /**
     * Update plan status (pause, activate, complete, archive).
     */
    public function updateStatus(Request $request, $id)
    {
        if ($denied = $this->checkFitnessAccess($request)) {
            return $denied;
        }

        $plan = MemberWorkoutPlan::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:draft,active,paused,completed,archived',
        ]);

        if ($validated['status'] === 'active') {
            MemberWorkoutPlan::where('member_id', $plan->member_id)
                ->where('id', '!=', $plan->id)
                ->where('status', 'active')
                ->update(['status' => 'archived', 'is_active' => false]);
        }

        $plan->update([
            'status' => $validated['status'],
            'is_active' => $validated['status'] === 'active',
        ]);

        return response()->json([
            'message' => "Plan status updated to '{$validated['status']}'",
            'workout_plan' => $plan,
        ]);
    }
}
