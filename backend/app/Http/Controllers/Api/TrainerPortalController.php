<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\AuditLog;
use App\Models\Member;
use App\Models\MemberDietPlan;
use App\Models\MemberProgressLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MemberWorkoutSession;
use App\Models\PtSession;
use App\Models\User;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;

class TrainerPortalController extends Controller
{
    /**
     * Resolve the trainer user from request.
     */
    protected function resolveTrainer(Request $request): User
    {
        $user = $request->user();

        // If trainer user
        if ($user->role === 'trainer') {
            return $user;
        }

        // Staff preview / trainerId parameter
        $trainerId = $request->query('trainer_id') ?: $request->input('trainer_id');
        if ($trainerId) {
            return User::where('gym_id', CurrentGym::require())->findOrFail($trainerId);
        }

        // Fallback to first trainer in gym
        $trainer = User::where('gym_id', CurrentGym::require())->where('role', 'trainer')->first();
        return $trainer ?: $user;
    }

    public function dashboard(Request $request)
    {
        $trainer = $this->resolveTrainer($request);
        $now = Carbon::now();

        $assignedMembersCount = Member::where('assigned_trainer_id', $trainer->id)
            ->where('status', 'active')
            ->count();

        $todaySessions = PtSession::with('member:id,first_name,last_name,phone,avatar_url')
            ->where('trainer_id', $trainer->id)
            ->whereDate('scheduled_at', $now->toDateString())
            ->orderBy('scheduled_at', 'asc')
            ->get();

        $monthStart = $now->copy()->startOfMonth()->toDateString();
        $monthEnd = $now->copy()->endOfMonth()->toDateString();

        $completedSessionsMonth = PtSession::where('trainer_id', $trainer->id)
            ->where('status', 'completed')
            ->whereBetween('scheduled_at', [$monthStart, $monthEnd . ' 23:59:59'])
            ->count();

        $sessionRate = (float) $trainer->pt_session_rate;
        $commissionPct = (float) $trainer->commission_percent;
        $sessionEarnings = round($completedSessionsMonth * $sessionRate, 2);

        return response()->json([
            'trainer' => [
                'id' => $trainer->id,
                'name' => $trainer->name,
                'specialization' => $trainer->specialization,
                'phone' => $trainer->phone,
                'avatar_url' => $trainer->avatar_url,
                'base_salary' => (float) $trainer->base_salary,
                'session_rate' => $sessionRate,
                'commission_percent' => $commissionPct,
            ],
            'metrics' => [
                'assigned_members_count' => $assignedMembersCount,
                'today_sessions_count' => $todaySessions->count(),
                'completed_sessions_month' => $completedSessionsMonth,
                'session_earnings_month' => $sessionEarnings,
            ],
            'today_sessions' => $todaySessions,
        ]);
    }

    public function members(Request $request)
    {
        $trainer = $this->resolveTrainer($request);

        $members = Member::with([
            'activeMembership.plan',
            'primaryBranch:id,name',
        ])
        ->where('assigned_trainer_id', $trainer->id)
        ->latest('id')
        ->get();

        return response()->json([
            'members' => $members,
        ]);
    }

    public function sessions(Request $request)
    {
        $trainer = $this->resolveTrainer($request);

        $query = PtSession::with('member:id,first_name,last_name,phone,member_code')
            ->where('trainer_id', $trainer->id);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('scheduled_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('scheduled_at', '<=', $request->query('to'));
        }

        $sessions = $query->latest('scheduled_at')->paginate(25);

        return response()->json([
            'sessions' => $sessions,
        ]);
    }

    public function completeSession(Request $request, $id)
    {
        $session = PtSession::findOrFail($id);

        $validated = $request->validate([
            'notes' => 'nullable|string|max:500',
            'client_feedback' => 'nullable|string|max:500',
        ]);

        $session->update([
            'status' => 'completed',
            'completed_at' => now(),
            'notes' => $validated['notes'] ?? $session->notes,
        ]);

        AuditLog::record('trainer.session_completed', [
            'session_id' => $session->id,
            'trainer_id' => $session->trainer_id,
            'member_id' => $session->member_id,
        ]);

        return response()->json([
            'message' => 'PT Session marked as completed successfully',
            'session' => $session->fresh(['member']),
        ]);
    }

    public function assignWorkout(Request $request)
    {
        $trainer = $this->resolveTrainer($request);

        $validated = $request->validate([
            'member_id' => 'required|exists:members,id',
            'title' => 'required|string|max:150',
            'goal' => 'required|string|in:fat_loss,muscle_hypertrophy,strength_conditioning,general_fitness,rehab',
            'difficulty' => 'required|string|in:beginner,intermediate,advanced',
            'days_per_week' => 'required|integer|min:1|max:7',
            'exercises' => 'required|array|min:1',
            'notes' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $plan = MemberWorkoutPlan::create([
            'gym_id' => CurrentGym::require(),
            'member_id' => $validated['member_id'],
            'trainer_id' => $trainer->id,
            'title' => $validated['title'],
            'goal' => $validated['goal'],
            'difficulty' => $validated['difficulty'],
            'days_per_week' => $validated['days_per_week'],
            'exercises' => $validated['exercises'],
            'notes' => $validated['notes'] ?? null,
            'start_date' => $validated['start_date'] ?? now()->toDateString(),
            'end_date' => $validated['end_date'] ?? now()->addMonths(2)->toDateString(),
            'is_active' => true,
        ]);

        AuditLog::record('workout_plan.assigned', [
            'plan_id' => $plan->id,
            'member_id' => $plan->member_id,
            'trainer_id' => $trainer->id,
            'title' => $plan->title,
        ]);

        return response()->json([
            'message' => 'Workout routine assigned to member successfully',
            'workout_plan' => $plan->load('member:id,first_name,last_name'),
        ], 201);
    }

    public function logProgress(Request $request)
    {
        $trainer = $this->resolveTrainer($request);

        $validated = $request->validate([
            'member_id' => 'required|exists:members,id',
            'log_date' => 'nullable|date',
            'weight_kg' => 'nullable|numeric|min:20|max:300',
            'body_fat_percent' => 'nullable|numeric|min:3|max:60',
            'chest_cm' => 'nullable|numeric|min:30|max:200',
            'waist_cm' => 'nullable|numeric|min:30|max:200',
            'arms_cm' => 'nullable|numeric|min:15|max:70',
            'notes' => 'nullable|string|max:500',
        ]);

        $log = MemberProgressLog::create([
            'gym_id' => CurrentGym::require(),
            'member_id' => $validated['member_id'],
            'logged_by_user_id' => $trainer->id,
            'log_date' => $validated['log_date'] ?? now()->toDateString(),
            'weight_kg' => $validated['weight_kg'] ?? null,
            'body_fat_percent' => $validated['body_fat_percent'] ?? null,
            'chest_cm' => $validated['chest_cm'] ?? null,
            'waist_cm' => $validated['waist_cm'] ?? null,
            'arms_cm' => $validated['arms_cm'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Progress log recorded successfully',
            'log' => $log,
        ], 201);
    }

    /**
     * Fitness overview metrics and assigned members triage for trainer.
     */
    public function fitnessOverview(Request $request)
    {
        $trainer = $this->resolveTrainer($request);
        $gymId = CurrentGym::require();
        $today = Carbon::today()->toDateString();
        $sevenDaysLater = Carbon::today()->addDays(7)->toDateString();

        $assignedMembers = Member::with([
            'activeWorkoutPlan',
            'activeDietPlan',
            'latestProgressLog',
            'workoutSessions' => function ($q) {
                $q->latest('session_date')->take(5);
            },
        ])
        ->where('gym_id', $gymId)
        ->where('assigned_trainer_id', $trainer->id)
        ->where('status', 'active')
        ->get();

        $assignedMemberIds = $assignedMembers->pluck('id');

        $activeWorkoutPlansCount = MemberWorkoutPlan::where('gym_id', $gymId)
            ->whereIn('member_id', $assignedMemberIds)
            ->where('status', 'active')
            ->count();

        $activeDietPlansCount = MemberDietPlan::where('gym_id', $gymId)
            ->whereIn('member_id', $assignedMemberIds)
            ->where('status', 'active')
            ->count();

        $todayCompletions = MemberWorkoutSession::where('gym_id', $gymId)
            ->whereIn('member_id', $assignedMemberIds)
            ->whereDate('session_date', $today)
            ->where('status', 'completed')
            ->count();

        $expiringPlans = MemberWorkoutPlan::with('member:id,first_name,last_name,phone')
            ->where('gym_id', $gymId)
            ->whereIn('member_id', $assignedMemberIds)
            ->where('status', 'active')
            ->whereBetween('end_date', [$today, $sevenDaysLater])
            ->get();

        return response()->json([
            'metrics' => [
                'assigned_members_count' => $assignedMembers->count(),
                'active_workout_plans_count' => $activeWorkoutPlansCount,
                'active_diet_plans_count' => $activeDietPlansCount,
                'today_workout_completions' => $todayCompletions,
                'expiring_plans_count' => $expiringPlans->count(),
            ],
            'assigned_members' => $assignedMembers,
            'expiring_plans' => $expiringPlans,
        ]);
    }

    /**
     * Get a member's full fitness dossier (plans, session logs, progress history).
     */
    public function memberFitnessDetail(Request $request, $id)
    {
        $trainer = $this->resolveTrainer($request);
        $gymId = CurrentGym::require();

        $member = Member::where('gym_id', $gymId)->findOrFail($id);

        $workoutPlans = MemberWorkoutPlan::where('gym_id', $gymId)
            ->where('member_id', $id)
            ->latest('id')
            ->get();

        $dietPlans = MemberDietPlan::where('gym_id', $gymId)
            ->where('member_id', $id)
            ->latest('id')
            ->get();

        $sessions = MemberWorkoutSession::where('gym_id', $gymId)
            ->where('member_id', $id)
            ->latest('session_date')
            ->take(20)
            ->get();

        $progressLogs = MemberProgressLog::where('gym_id', $gymId)
            ->where('member_id', $id)
            ->latest('log_date')
            ->take(30)
            ->get();

        return response()->json([
            'member' => $member,
            'workout_plans' => $workoutPlans,
            'diet_plans' => $dietPlans,
            'sessions' => $sessions,
            'progress_logs' => $progressLogs,
        ]);
    }

    /**
     * Quick assign diet plan for trainer.
     */
    public function assignDiet(Request $request)
    {
        $trainer = $this->resolveTrainer($request);
        $gymId = CurrentGym::require();

        $validated = $request->validate([
            'member_id' => 'required|exists:members,id',
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
        ]);

        $member = Member::where('gym_id', $gymId)->findOrFail($validated['member_id']);

        // Archive previous active diet plan
        MemberDietPlan::where('gym_id', $gymId)
            ->where('member_id', $member->id)
            ->where('status', 'active')
            ->update(['status' => 'archived']);

        $plan = MemberDietPlan::create([
            'gym_id' => $gymId,
            'branch_id' => $member->primary_branch_id,
            'member_id' => $member->id,
            'trainer_id' => $trainer->id,
            'title' => $validated['title'],
            'goal' => $validated['goal'],
            'dietary_preference' => $validated['dietary_preference'],
            'food_allergies' => $validated['food_allergies'] ?? null,
            'food_preferences' => $validated['food_preferences'] ?? null,
            'target_calories' => $validated['target_calories'] ?? 2000,
            'target_protein_g' => $validated['target_protein_g'] ?? 120,
            'target_carbs_g' => $validated['target_carbs_g'] ?? 200,
            'target_fat_g' => $validated['target_fat_g'] ?? 60,
            'meals' => $validated['meals'],
            'start_date' => $validated['start_date'] ?? now()->toDateString(),
            'end_date' => $validated['end_date'] ?? now()->addMonths(2)->toDateString(),
            'notes' => $validated['notes'] ?? null,
            'status' => 'active',
            'version' => 1,
        ]);

        AuditLog::record('diet_plan.assigned', [
            'plan_id' => $plan->id,
            'member_id' => $plan->member_id,
            'trainer_id' => $trainer->id,
            'title' => $plan->title,
        ]);

        return response()->json([
            'message' => 'Diet plan assigned successfully',
            'diet_plan' => $plan->load('member:id,first_name,last_name'),
        ], 201);
    }
}
