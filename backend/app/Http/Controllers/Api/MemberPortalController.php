<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Member;
use App\Models\MemberDietPlan;
use App\Models\MemberMealLog;
use App\Models\MemberMembership;
use App\Models\MemberProgressLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MemberWorkoutSession;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\PtSession;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MemberPortalController extends Controller
{
    /**
     * Resolve the current member from the request.
     * Can be authenticated member user, or requested by member ID for preview.
     */
    protected function resolveMember(Request $request): Member
    {
        $user = $request->user();

        // If member user
        if ($user && $user->role === 'member') {
            $member = Member::where('gym_id', $user->gym_id)
                ->where(function ($q) use ($user) {
                    $q->where('phone', $user->phone)->orWhere('email', $user->email);
                })
                ->first();

            if ($member) {
                return $member;
            }
        }

        // Staff preview / specific member lookup
        $memberId = $request->query('member_id') ?: $request->input('member_id');
        if ($memberId) {
            return Member::where('gym_id', CurrentGym::require())->findOrFail($memberId);
        }

        // Fallback to first member in gym
        return Member::where('gym_id', CurrentGym::require())->firstOrFail();
    }

    public function profile(Request $request)
    {
        $member = $this->resolveMember($request);
        $member->load([
            'primaryBranch:id,name,code,address',
            'trainer:id,name,phone,specialization,avatar_url',
            'activeMembership.plan',
        ]);

        $activeSub = $member->activeMembership;
        $daysRemaining = 0;
        $isExpiringSoon = false;

        if ($activeSub) {
            $endDate = Carbon::parse($activeSub->end_date);
            $today = Carbon::today();
            $daysRemaining = max(0, $today->diffInDays($endDate, false));
            $isExpiringSoon = $daysRemaining <= 7 && $daysRemaining >= 0;
        }

        return response()->json([
            'member' => $member,
            'card' => [
                'member_code' => $member->member_code,
                'full_name' => $member->full_name,
                'status' => $member->status,
                'joined_date' => $member->joined_date?->toDateString(),
                'branch_name' => $member->primaryBranch?->name,
                'plan_name' => $activeSub?->plan?->name ?? 'No Active Plan',
                'start_date' => $activeSub?->start_date,
                'end_date' => $activeSub?->end_date,
                'days_remaining' => (int) $daysRemaining,
                'is_expiring_soon' => $isExpiringSoon,
                'outstanding_balance' => (float) $member->outstanding_balance,
            ],
        ]);
    }

    public function attendance(Request $request)
    {
        $member = $this->resolveMember($request);

        $logs = AttendanceLog::with('branch:id,name')
            ->where('member_id', $member->id)
            ->latest('check_in_at')
            ->take(30)
            ->get();

        $thisMonthCheckins = AttendanceLog::where('member_id', $member->id)
            ->whereBetween('check_in_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        return response()->json([
            'streak_this_month' => $thisMonthCheckins,
            'attendance' => $logs,
        ]);
    }

    public function payments(Request $request)
    {
        $member = $this->resolveMember($request);

        $payments = Payment::with('branch:id,name')
            ->where('member_id', $member->id)
            ->where('status', 'completed')
            ->latest('payment_date')
            ->take(20)
            ->get();

        $posOrders = PosOrder::with('items.product')
            ->where('member_id', $member->id)
            ->latest('order_date')
            ->take(20)
            ->get();

        return response()->json([
            'total_billed' => (float) $member->total_fees_billed,
            'total_paid' => (float) $member->total_fees_paid,
            'outstanding_balance' => (float) $member->outstanding_balance,
            'membership_payments' => $payments,
            'supplement_orders' => $posOrders,
        ]);
    }

    public function workouts(Request $request)
    {
        $member = $this->resolveMember($request);

        $workouts = MemberWorkoutPlan::with('trainer:id,name,phone')
            ->where('member_id', $member->id)
            ->latest('start_date')
            ->get();

        return response()->json([
            'workouts' => $workouts,
        ]);
    }

    public function ptSessions(Request $request)
    {
        $member = $this->resolveMember($request);

        $sessions = PtSession::with('trainer:id,name,phone,specialization')
            ->where('member_id', $member->id)
            ->latest('scheduled_at')
            ->take(20)
            ->get();

        return response()->json([
            'sessions' => $sessions,
        ]);
    }

    public function progress(Request $request)
    {
        $member = $this->resolveMember($request);

        $progressLogs = MemberProgressLog::where('member_id', $member->id)
            ->latest('log_date')
            ->take(15)
            ->get();

        return response()->json([
            'logs' => $progressLogs,
        ]);
    }

    /**
     * Today's Fitness Experience for Mobile Member Portal
     * Returns Today's Workout, Today's Meals, completion status & streak.
     */
    public function fitnessToday(Request $request)
    {
        $member = $this->resolveMember($request);
        $today = Carbon::today();
        $dayOfWeekName = $today->format('l'); // Monday, Tuesday, etc.
        $dayIndex = $today->dayOfWeekIso - 1; // 0 for Mon, 6 for Sun

        // 1. Get active workout plan
        $activeWorkoutPlan = MemberWorkoutPlan::with('trainer:id,name,phone,avatar_url')
            ->where('member_id', $member->id)
            ->where('status', 'active')
            ->latest('id')
            ->first();

        $todayWorkout = null;
        $todaySession = null;

        if ($activeWorkoutPlan) {
            $scheduleDays = $activeWorkoutPlan->schedule ?: $activeWorkoutPlan->exercises ?: [];
            // Try to match day by dayOfWeekName or dayIndex
            $matchedDay = null;
            foreach ($scheduleDays as $idx => $dayItem) {
                $dayName = $dayItem['day_name'] ?? $dayItem['day'] ?? '';
                if (stripos($dayName, $dayOfWeekName) !== false || $idx === $dayIndex) {
                    $matchedDay = $dayItem;
                    break;
                }
            }

            if (!$matchedDay && count($scheduleDays) > 0) {
                $matchedDay = $scheduleDays[0];
            }

            // Check if member already logged a session today
            $todaySession = MemberWorkoutSession::where('member_id', $member->id)
                ->where('workout_plan_id', $activeWorkoutPlan->id)
                ->whereDate('session_date', $today->toDateString())
                ->first();

            $todayWorkout = [
                'plan_id' => $activeWorkoutPlan->id,
                'plan_title' => $activeWorkoutPlan->title,
                'goal' => $activeWorkoutPlan->goal,
                'difficulty' => $activeWorkoutPlan->difficulty,
                'trainer' => $activeWorkoutPlan->trainer,
                'day_name' => $matchedDay['day_name'] ?? $matchedDay['day'] ?? 'Today\'s Routine',
                'is_rest_day' => !empty($matchedDay['is_rest_day']),
                'exercises' => $matchedDay['exercises'] ?? $matchedDay['items'] ?? [],
                'coach_notes' => $activeWorkoutPlan->notes,
                'session' => $todaySession,
                'status' => $todaySession ? $todaySession->status : 'not_started',
            ];
        }

        // 2. Get active diet plan & today's completed meal logs
        $activeDietPlan = MemberDietPlan::with('trainer:id,name,phone')
            ->where('member_id', $member->id)
            ->where('status', 'active')
            ->latest('id')
            ->first();

        $todayDiet = null;
        if ($activeDietPlan) {
            $mealLogs = MemberMealLog::where('member_id', $member->id)
                ->where('diet_plan_id', $activeDietPlan->id)
                ->whereDate('log_date', $today->toDateString())
                ->get()
                ->keyBy('meal_slot');

            $allMeals = $activeDietPlan->meals ?: [];
            $completedCount = 0;
            $totalCount = count($allMeals);

            $formattedMeals = [];
            foreach ($allMeals as $m) {
                $slotKey = strtolower(str_replace(' ', '_', $m['slot'] ?? 'meal'));
                $isDone = isset($mealLogs[$slotKey]) && $mealLogs[$slotKey]->is_completed;
                if ($isDone) $completedCount++;

                $formattedMeals[] = [
                    'slot' => $slotKey,
                    'slot_title' => $m['slot_title'] ?? ucfirst(str_replace('_', ' ', $slotKey)),
                    'time' => $m['time'] ?? 'Flexible',
                    'items' => $m['items'] ?? [],
                    'is_completed' => $isDone,
                    'completed_at' => $isDone ? $mealLogs[$slotKey]->completed_at : null,
                ];
            }

            $todayDiet = [
                'plan_id' => $activeDietPlan->id,
                'title' => $activeDietPlan->title,
                'goal' => $activeDietPlan->goal,
                'dietary_preference' => $activeDietPlan->dietary_preference,
                'target_calories' => $activeDietPlan->target_calories,
                'target_protein_g' => $activeDietPlan->target_protein_g,
                'target_carbs_g' => $activeDietPlan->target_carbs_g,
                'target_fat_g' => $activeDietPlan->target_fat_g,
                'meals' => $formattedMeals,
                'completed_meals_count' => $completedCount,
                'total_meals_count' => $totalCount,
                'completion_percent' => $totalCount > 0 ? round(($completedCount / $totalCount) * 100) : 0,
            ];
        }

        // 3. Streak & Attendance
        $streak = AttendanceLog::where('member_id', $member->id)
            ->whereBetween('check_in_at', [now()->subDays(30), now()])
            ->count();

        return response()->json([
            'today_date' => $today->toDateString(),
            'day_of_week' => $dayOfWeekName,
            'member' => [
                'id' => $member->id,
                'first_name' => $member->first_name,
                'full_name' => $member->full_name,
                'avatar_url' => $member->avatar_url,
            ],
            'streak_score' => $streak,
            'today_workout' => $todayWorkout,
            'today_diet' => $todayDiet,
        ]);
    }

    /**
     * Member logs set progress during workout session.
     */
    public function logWorkoutSet(Request $request)
    {
        $member = $this->resolveMember($request);

        if (empty($request->workout_plan_id) && $member->activeWorkoutPlan) {
            $request->merge(['workout_plan_id' => $member->activeWorkoutPlan->id]);
        }
        if (empty($request->day_name)) {
            $request->merge(['day_name' => now()->format('l') . ' - Workout']);
        }

        $validated = $request->validate([
            'workout_plan_id' => 'required|exists:member_workout_plans,id',
            'day_name' => 'required|string|max:100',
            'exercise_name' => 'required|string|max:150',
            'set_number' => 'required|integer|min:1',
            'reps' => 'required|numeric|min:1',
            'weight_kg' => 'nullable|numeric|min:0',
            'completed' => 'nullable|boolean',
        ]);

        $today = now()->toDateString();

        $session = MemberWorkoutSession::firstOrCreate(
            [
                'gym_id' => $member->gym_id,
                'member_id' => $member->id,
                'session_date' => $today,
            ],
            [
                'branch_id' => $member->primary_branch_id,
                'workout_plan_id' => $validated['workout_plan_id'],
                'day_name' => $validated['day_name'],
                'status' => 'in_progress',
                'set_logs' => [],
            ]
        );

        $setLogs = $session->set_logs ?: [];
        $setLogs[] = [
            'exercise_name' => $validated['exercise_name'],
            'set_number' => $validated['set_number'],
            'reps' => $validated['reps'],
            'weight_kg' => $validated['weight_kg'] ?? 0,
            'completed' => $validated['completed'] ?? true,
            'logged_at' => now()->toTimeString(),
        ];

        $session->update([
            'set_logs' => $setLogs,
            'status' => 'in_progress',
        ]);

        return response()->json([
            'message' => 'Set recorded successfully',
            'session' => $session,
        ]);
    }

    /**
     * Member marks today's workout as completed.
     */
    public function completeWorkoutSession(Request $request)
    {
        $member = $this->resolveMember($request);

        if (empty($request->workout_plan_id) && $member->activeWorkoutPlan) {
            $request->merge(['workout_plan_id' => $member->activeWorkoutPlan->id]);
        }
        if (empty($request->day_name)) {
            $request->merge(['day_name' => now()->format('l') . ' - Workout']);
        }

        $validated = $request->validate([
            'workout_plan_id' => 'required|exists:member_workout_plans,id',
            'day_name' => 'required|string|max:100',
            'duration_minutes' => 'nullable|integer|min:5|max:300',
            'notes' => 'nullable|string|max:500',
            'rating' => 'nullable|integer|min:1|max:5',
        ]);

        $today = now()->toDateString();

        $session = MemberWorkoutSession::updateOrCreate(
            [
                'gym_id' => $member->gym_id,
                'member_id' => $member->id,
                'session_date' => $today,
            ],
            [
                'branch_id' => $member->primary_branch_id,
                'workout_plan_id' => $validated['workout_plan_id'],
                'day_name' => $validated['day_name'],
                'status' => 'completed',
                'duration_minutes' => $validated['duration_minutes'] ?? 45,
                'notes' => $validated['notes'] ?? null,
                'rating' => $validated['rating'] ?? 5,
                'completed_at' => now(),
            ]
        );

        AuditLog::record('workout_session.completed', [
            'member_id' => $member->id,
            'day_name' => $session->day_name,
            'duration' => $session->duration_minutes,
        ]);

        return response()->json([
            'message' => 'Great job! Workout marked as completed for today!',
            'session' => $session,
        ]);
    }

    /**
     * Member toggles meal slot completion for today.
     */
    public function toggleMealLog(Request $request)
    {
        $member = $this->resolveMember($request);

        if (empty($request->diet_plan_id) && $member->activeDietPlan) {
            $request->merge(['diet_plan_id' => $member->activeDietPlan->id]);
        }
        if (empty($request->meal_slot)) {
            $request->merge(['meal_slot' => $request->slot_name ?: $request->slot ?: 'meal']);
        }
        if ($request->is_completed === null) {
            $request->merge(['is_completed' => true]);
        }

        $validated = $request->validate([
            'diet_plan_id' => 'required|exists:member_diet_plans,id',
            'meal_slot' => 'required|string|max:40',
            'is_completed' => 'required|boolean',
            'notes' => 'nullable|string|max:255',
        ]);

        $today = now()->toDateString();
        $slotKey = strtolower(str_replace(' ', '_', $validated['meal_slot']));

        $log = MemberMealLog::updateOrCreate(
            [
                'gym_id' => $member->gym_id,
                'member_id' => $member->id,
                'diet_plan_id' => $validated['diet_plan_id'],
                'log_date' => $today,
                'meal_slot' => $slotKey,
            ],
            [
                'is_completed' => $validated['is_completed'],
                'completed_at' => $validated['is_completed'] ? now() : null,
                'notes' => $validated['notes'] ?? null,
            ]
        );

        return response()->json([
            'message' => $validated['is_completed'] ? 'Meal marked as completed' : 'Meal marked as pending',
            'is_completed' => (bool) $log->is_completed,
            'meal_log' => $log,
        ]);
    }

    /**
     * Get member progress trends and history.
     */
    public function myProgress(Request $request)
    {
        $member = $this->resolveMember($request);

        $progressLogs = MemberProgressLog::where('member_id', $member->id)
            ->latest('log_date')
            ->take(30)
            ->get();

        $completedWorkoutsCount = MemberWorkoutSession::where('member_id', $member->id)
            ->where('status', 'completed')
            ->count();

        $completedMealsCount = MemberMealLog::where('member_id', $member->id)
            ->where('is_completed', true)
            ->count();

        return response()->json([
            'progress_logs' => $progressLogs,
            'stats' => [
                'total_workouts_completed' => $completedWorkoutsCount,
                'total_meals_logged' => $completedMealsCount,
                'initial_weight' => $progressLogs->last()?->weight_kg,
                'current_weight' => $progressLogs->first()?->weight_kg,
            ],
        ]);
    }

    /**
     * Member self-records progress.
     */
    public function recordProgress(Request $request)
    {
        $member = $this->resolveMember($request);

        $validated = $request->validate([
            'log_date' => 'nullable|date',
            'height_cm' => 'nullable|numeric|min:50|max:250',
            'weight_kg' => 'nullable|numeric|min:20|max:300',
            'body_fat_percent' => 'nullable|numeric|min:3|max:60',
            'chest_cm' => 'nullable|numeric|min:30|max:200',
            'waist_cm' => 'nullable|numeric|min:30|max:200',
            'hips_cm' => 'nullable|numeric|min:30|max:200',
            'arms_cm' => 'nullable|numeric|min:15|max:70',
            'thighs_cm' => 'nullable|numeric|min:20|max:100',
            'calves_cm' => 'nullable|numeric|min:15|max:70',
            'photo_url' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        $log = MemberProgressLog::create([
            'gym_id' => $member->gym_id,
            'member_id' => $member->id,
            'logged_by_user_id' => $request->user()?->id,
            'logged_by_role' => $request->user()?->role ?: 'member',
            'log_date' => $validated['log_date'] ?? now()->toDateString(),
            'height_cm' => $validated['height_cm'] ?? null,
            'weight_kg' => $validated['weight_kg'] ?? null,
            'body_fat_percent' => $validated['body_fat_percent'] ?? null,
            'chest_cm' => $validated['chest_cm'] ?? null,
            'waist_cm' => $validated['waist_cm'] ?? null,
            'hips_cm' => $validated['hips_cm'] ?? null,
            'arms_cm' => $validated['arms_cm'] ?? null,
            'thighs_cm' => $validated['thighs_cm'] ?? null,
            'calves_cm' => $validated['calves_cm'] ?? null,
            'photo_url' => $validated['photo_url'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Progress recorded successfully!',
            'log' => $log,
            'progress_log' => $log,
        ], 201);
    }

    public function renewRequest(Request $request)
    {
        $member = $this->resolveMember($request);

        $validated = $request->validate([
            'membership_plan_id' => 'required|exists:membership_plans,id',
            'notes' => 'nullable|string|max:255',
        ]);

        $plan = MembershipPlan::findOrFail($validated['membership_plan_id']);

        ActionItem::create([
            'gym_id' => $member->gym_id,
            'branch_id' => $member->primary_branch_id,
            'type' => 'expiring_membership',
            'severity' => 'warning',
            'title' => "Online Renewal Request: {$member->full_name} ({$plan->name})",
            'description' => "Member {$member->full_name} requested renewal for {$plan->name} (₹{$plan->price}). Phone: {$member->phone}.",
            'reference_type' => 'member',
            'reference_id' => $member->id,
            'status' => 'pending',
            'due_date' => now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Renewal request submitted successfully! Reception staff will contact you or confirm payment.',
        ]);
    }

    public function updateProfile(Request $request)
    {
        $member = $this->resolveMember($request);

        $validated = $request->validate([
            'phone' => 'sometimes|required|string|max:20',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:255',
            'emergency_contact_name' => 'nullable|string|max:100',
            'emergency_contact_phone' => 'nullable|string|max:30',
            'blood_group' => 'nullable|string|max:10',
        ]);

        $member->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully',
            'member' => $member->fresh(),
        ]);
    }
}
