<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Exercise;
use App\Models\ExerciseCategory;
use App\Models\Invoice;
use App\Models\Member;
use App\Models\MemberDietPlan;
use App\Models\MemberFitnessGoal;
use App\Models\MemberMealLog;
use App\Models\MemberMembership;
use App\Models\MemberProgressLog;
use App\Models\MemberWaterLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MemberWorkoutSession;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\PtSession;
use App\Services\ExerciseVideoResolverService;
use App\Services\FinanceService;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
            ->take(50)
            ->get();

        $startOfMonth = now()->startOfMonth();
        $endOfMonth = now()->endOfMonth();

        $monthLogs = AttendanceLog::where('member_id', $member->id)
            ->whereBetween('check_in_at', [$startOfMonth, $endOfMonth])
            ->get();

        $visitedDates = $monthLogs->map(fn ($l) => Carbon::parse($l->check_in_at)->toDateString())->unique()->values()->all();
        $thisMonthVisits = count($visitedDates);

        $startOfWeek = now()->startOfWeek();
        $thisWeekVisits = AttendanceLog::where('member_id', $member->id)
            ->where('check_in_at', '>=', $startOfWeek)
            ->get()
            ->map(fn ($l) => Carbon::parse($l->check_in_at)->toDateString())
            ->unique()
            ->count();

        // Calculate consecutive daily attendance streak
        $allDates = AttendanceLog::where('member_id', $member->id)
            ->where('check_in_at', '>=', now()->subDays(60))
            ->get()
            ->map(fn ($l) => Carbon::parse($l->check_in_at)->toDateString())
            ->unique()
            ->sortDesc()
            ->values();

        $streakDays = 0;
        $todayStr = now()->toDateString();
        $yesterdayStr = now()->subDay()->toDateString();

        if ($allDates->contains($todayStr) || $allDates->contains($yesterdayStr)) {
            $curr = $allDates->contains($todayStr) ? now() : now()->subDay();
            while ($allDates->contains($curr->toDateString())) {
                $streakDays++;
                $curr->subDay();
            }
        }

        $lastLog = $logs->first();
        $lastVisitText = 'No check-in yet';
        if ($lastLog) {
            $lastDate = Carbon::parse($lastLog->check_in_at);
            if ($lastDate->isToday()) {
                $lastVisitText = 'Today at ' . $lastDate->format('h:i A');
            } elseif ($lastDate->isYesterday()) {
                $lastVisitText = 'Yesterday';
            } else {
                $lastVisitText = $lastDate->format('d M Y');
            }
        }

        return response()->json([
            'streak_this_month' => $thisMonthVisits,
            'total_visits_this_month' => $thisMonthVisits,
            'visits_this_week' => $thisWeekVisits,
            'streak_days' => $streakDays,
            'last_check_in' => $lastVisitText,
            'visited_dates' => $visitedDates,
            'attendance' => $logs,
            'recent_logs' => $logs->take(15),
        ]);
    }

    public function payments(Request $request)
    {
        $member = $this->resolveMember($request);

        app(FinanceService::class)->ensureInvoicesForMemberships($member->gym_id);

        $payments = Payment::with('branch:id,name')
            ->where('member_id', $member->id)
            ->where('status', 'completed')
            ->latest('payment_date')
            ->take(20)
            ->get();

        $invoices = Invoice::with(['branch:id,name', 'membership.plan:id,name', 'allocations.payment'])
            ->where('member_id', $member->id)
            ->latest('due_date')
            ->get()
            ->map(function ($inv) {
                $inv->effective_status = $inv->calculateDynamicStatus();
                return $inv;
            });

        $posOrders = PosOrder::with('items.product')
            ->where('member_id', $member->id)
            ->latest('order_date')
            ->take(20)
            ->get();

        return response()->json([
            'total_billed' => (float) $member->total_fees_billed,
            'total_paid' => (float) $member->total_fees_paid,
            'outstanding_balance' => (float) $member->outstanding_balance,
            'invoices' => $invoices,
            'membership_payments' => $payments,
            'supplement_orders' => $posOrders,
        ]);
    }

    public function createDuePaymentOrder(Request $request, int $invoiceId)
    {
        $member = $this->resolveMember($request);
        $invoice = Invoice::where('member_id', $member->id)->findOrFail($invoiceId);

        if ($invoice->balance_due <= 0 || $invoice->status === 'cancelled') {
            return response()->json(['message' => 'No outstanding balance for this invoice.'], 422);
        }

        $amount = $request->input('amount') ? min((float) $invoice->balance_due, (float) $request->input('amount')) : (float) $invoice->balance_due;

        $orderId = 'order_' . Str::random(16);
        $invoice->update(['razorpay_order_id' => $orderId]);

        $keyId = config('services.razorpay.key_id') ?: env('RAZORPAY_KEY_ID', 'rzp_test_public_demo');

        return response()->json([
            'order_id' => $orderId,
            'amount' => $amount,
            'currency' => 'INR',
            'razorpay_key_id' => $keyId,
            'invoice_number' => $invoice->invoice_number,
        ]);
    }

    public function verifyDuePayment(Request $request, int $invoiceId)
    {
        $member = $this->resolveMember($request);
        $invoice = Invoice::where('member_id', $member->id)->findOrFail($invoiceId);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_order_id' => ['nullable', 'string'],
            'razorpay_signature' => ['nullable', 'string'],
        ]);

        // Signature check if secret configured
        $keySecret = config('services.razorpay.key_secret') ?: env('RAZORPAY_KEY_SECRET');
        if ($keySecret && !empty($validated['razorpay_signature']) && !empty($validated['razorpay_order_id'])) {
            $expectedSignature = hash_hmac('sha256', $validated['razorpay_order_id'] . '|' . $validated['razorpay_payment_id'], $keySecret);
            if (!hash_equals($expectedSignature, $validated['razorpay_signature'])) {
                return response()->json(['message' => 'Payment signature verification failed.'], 400);
            }
        }

        $financeService = app(FinanceService::class);
        $result = $financeService->collectInstallment(
            invoiceId: $invoice->id,
            amount: (float) $validated['amount'],
            paymentMethod: 'online',
            paymentDate: now()->toDateString(),
            referenceId: $validated['razorpay_payment_id'],
            notes: "Online payment via Razorpay ({$validated['razorpay_payment_id']})",
            user: $request->user(),
            clientUuid: $validated['razorpay_payment_id']
        );

        return response()->json([
            'message' => 'Payment confirmed and receipt generated.',
            'payment' => $result['payment'],
            'invoice' => $result['invoice'],
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

            $rawExercises = $matchedDay['exercises'] ?? $matchedDay['items'] ?? [];
            $resolvedExercises = app(ExerciseVideoResolverService::class)->resolveBulkForWorkout($rawExercises, $member->gym_id);

            $todayWorkout = [
                'plan_id' => $activeWorkoutPlan->id,
                'plan_title' => $activeWorkoutPlan->title,
                'goal' => $activeWorkoutPlan->goal,
                'difficulty' => $activeWorkoutPlan->difficulty,
                'trainer' => $activeWorkoutPlan->trainer,
                'day_name' => $matchedDay['day_name'] ?? $matchedDay['day'] ?? 'Today\'s Routine',
                'is_rest_day' => !empty($matchedDay['is_rest_day']),
                'exercises' => $resolvedExercises,
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

        // 3. Water Intake Tracking
        $waterTarget = $activeDietPlan?->water_target_ml ?: 2500;
        $waterLog = MemberWaterLog::firstOrCreate(
            [
                'gym_id' => $member->gym_id,
                'member_id' => $member->id,
                'log_date' => $today->toDateString(),
            ],
            [
                'target_ml' => $waterTarget,
                'consumed_ml' => 0,
            ]
        );

        // 4. Fitness Goal & Weight Progress
        $activeGoal = MemberFitnessGoal::where('member_id', $member->id)
            ->where('status', 'in_progress')
            ->latest('id')
            ->first();

        $progLogs = MemberProgressLog::where('member_id', $member->id)->orderBy('log_date', 'asc')->get();
        $initialWeight = $progLogs->first()?->weight_kg;
        $currentWeight = $progLogs->last()?->weight_kg;
        $weightChange = ($currentWeight && $initialWeight) ? round($currentWeight - $initialWeight, 1) : null;

        // 5. Attendance Summary & Streak
        $thisMonthLogs = AttendanceLog::where('member_id', $member->id)
            ->whereBetween('check_in_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->get();
        $monthVisits = $thisMonthLogs->map(fn ($l) => Carbon::parse($l->check_in_at)->toDateString())->unique()->count();

        $allDates = AttendanceLog::where('member_id', $member->id)
            ->where('check_in_at', '>=', now()->subDays(60))
            ->get()
            ->map(fn ($l) => Carbon::parse($l->check_in_at)->toDateString())
            ->unique()
            ->sortDesc()
            ->values();

        $streakDays = 0;
        $todayStr = now()->toDateString();
        $yesterdayStr = now()->subDay()->toDateString();
        if ($allDates->contains($todayStr) || $allDates->contains($yesterdayStr)) {
            $curr = $allDates->contains($todayStr) ? now() : now()->subDay();
            while ($allDates->contains($curr->toDateString())) {
                $streakDays++;
                $curr->subDay();
            }
        }

        $lastAtt = AttendanceLog::where('member_id', $member->id)->latest('check_in_at')->first();
        $lastVisitText = 'No check-in yet';
        if ($lastAtt) {
            $d = Carbon::parse($lastAtt->check_in_at);
            $lastVisitText = $d->isToday() ? 'Today' : ($d->isYesterday() ? 'Yesterday' : $d->format('d M'));
        }

        // 6. Assigned Trainer
        $trainer = $member->trainer;
        $trainerInfo = $trainer ? [
            'id' => $trainer->id,
            'name' => $trainer->name,
            'phone' => $trainer->phone,
            'avatar_url' => $trainer->avatar_url,
            'specialization' => $trainer->specialization ?: 'Personal Trainer',
            'plan_status' => $activeWorkoutPlan ? 'Active Plan Assigned' : 'Awaiting Plan',
            'last_plan_update' => $activeWorkoutPlan?->updated_at?->diffForHumans() ?? 'No active plan',
        ] : null;

        return response()->json([
            'today_date' => $today->toDateString(),
            'day_of_week' => $dayOfWeekName,
            'member' => [
                'id' => $member->id,
                'first_name' => $member->first_name,
                'full_name' => $member->full_name,
                'avatar_url' => $member->avatar_url,
                'membership_status' => $member->status,
                'member_code' => $member->member_code,
            ],
            'today_workout' => $todayWorkout,
            'today_diet' => $todayDiet,
            'water' => [
                'target_ml' => $waterLog->target_ml,
                'consumed_ml' => $waterLog->consumed_ml,
                'percent' => min(100, (int) round(($waterLog->consumed_ml / max(1, $waterLog->target_ml)) * 100)),
            ],
            'progress_overview' => [
                'initial_weight' => $initialWeight,
                'current_weight' => $currentWeight,
                'weight_change' => $weightChange,
                'goal_title' => $activeGoal?->title ?? 'Weight Target',
                'goal_target' => $activeGoal?->target_value ?? ($initialWeight ? max(40, $initialWeight - 5) : null),
                'goal_percent' => $activeGoal?->progress_percent ?? 50,
                'total_workouts_completed' => MemberWorkoutSession::where('member_id', $member->id)->where('status', 'completed')->count(),
            ],
            'attendance_summary' => [
                'month_visits' => $monthVisits,
                'streak_days' => $streakDays,
                'last_check_in' => $lastVisitText,
            ],
            'trainer' => $trainerInfo,
        ]);
    }

    /**
     * Member logs or increments water intake (+250ml tap).
     */
    public function logWater(Request $request)
    {
        $member = $this->resolveMember($request);
        $today = now()->toDateString();
        $amount = (int) ($request->input('amount_ml', 250));
        $action = $request->input('action', 'add'); // add, subtract, set

        $waterLog = MemberWaterLog::firstOrCreate(
            [
                'gym_id' => $member->gym_id,
                'member_id' => $member->id,
                'log_date' => $today,
            ],
            [
                'target_ml' => $member->activeDietPlan?->water_target_ml ?: 2500,
                'consumed_ml' => 0,
            ]
        );

        if ($action === 'set') {
            $waterLog->consumed_ml = max(0, $amount);
        } elseif ($action === 'subtract') {
            $waterLog->consumed_ml = max(0, $waterLog->consumed_ml - $amount);
        } else {
            $waterLog->consumed_ml += $amount;
        }

        $waterLog->save();

        return response()->json([
            'message' => 'Water intake updated successfully',
            'water' => [
                'target_ml' => $waterLog->target_ml,
                'consumed_ml' => $waterLog->consumed_ml,
                'percent' => min(100, (int) round(($waterLog->consumed_ml / max(1, $waterLog->target_ml)) * 100)),
            ],
        ]);
    }

    /**
     * Get member goals.
     */
    public function goals(Request $request)
    {
        $member = $this->resolveMember($request);

        $goals = MemberFitnessGoal::where('member_id', $member->id)
            ->latest('id')
            ->get()
            ->map(function ($g) {
                $g->progress_percent = $g->progress_percent;
                return $g;
            });

        return response()->json([
            'goals' => $goals,
            'active_goal' => $goals->firstWhere('status', 'in_progress'),
        ]);
    }

    /**
     * Create or update member goal.
     */
    public function storeGoal(Request $request)
    {
        $member = $this->resolveMember($request);

        $validated = $request->validate([
            'title' => 'required|string|max:120',
            'category' => 'nullable|string|max:40',
            'start_value' => 'nullable|numeric',
            'target_value' => 'nullable|numeric',
            'current_value' => 'nullable|numeric',
            'unit' => 'nullable|string|max:20',
            'target_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
        ]);

        $latestLog = MemberProgressLog::where('member_id', $member->id)->latest('log_date')->first();
        $startVal = $validated['start_value'] ?? $latestLog?->weight_kg;
        $currVal = $validated['current_value'] ?? $latestLog?->weight_kg ?? $startVal;

        $goal = MemberFitnessGoal::create([
            'gym_id' => $member->gym_id,
            'member_id' => $member->id,
            'created_by_user_id' => $request->user()?->id,
            'title' => $validated['title'],
            'category' => $validated['category'] ?? 'weight',
            'start_value' => $startVal,
            'target_value' => $validated['target_value'] ?? null,
            'current_value' => $currVal,
            'unit' => $validated['unit'] ?? 'kg',
            'start_date' => now()->toDateString(),
            'target_date' => $validated['target_date'] ?? now()->addWeeks(8)->toDateString(),
            'status' => 'in_progress',
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Fitness goal saved successfully!',
            'goal' => $goal,
        ], 201);
    }

    /**
     * 30-Day Factual Progress Summary Report
     */
    public function summary30Days(Request $request)
    {
        $member = $this->resolveMember($request);
        $since = now()->subDays(30);

        $visits = AttendanceLog::where('member_id', $member->id)
            ->where('check_in_at', '>=', $since)
            ->count();

        $workoutsCompleted = MemberWorkoutSession::where('member_id', $member->id)
            ->where('session_date', '>=', $since->toDateString())
            ->where('status', 'completed')
            ->count();

        $logs = MemberProgressLog::where('member_id', $member->id)
            ->orderBy('log_date', 'asc')
            ->get();

        $initialWeight = $logs->first()?->weight_kg;
        $currentWeight = $logs->last()?->weight_kg;
        $weightChange = ($currentWeight && $initialWeight) ? round($currentWeight - $initialWeight, 1) : null;

        $activeGoal = MemberFitnessGoal::where('member_id', $member->id)
            ->where('status', 'in_progress')
            ->latest('id')
            ->first();

        return response()->json([
            'days' => 30,
            'gym_visits' => $visits,
            'workouts_completed' => $workoutsCompleted,
            'initial_weight' => $initialWeight,
            'current_weight' => $currentWeight,
            'weight_change' => $weightChange,
            'current_goal_target' => $activeGoal?->target_value,
            'current_goal_title' => $activeGoal?->title ?? 'Fitness Target',
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

    /**
     * Standalone Exercise Library for Member Portal Exploration
     */
    public function exerciseLibrary(Request $request)
    {
        $member = $this->resolveMember($request);
        $gym = $member->gym;

        $settings = $gym->video_library_settings ?? [];
        $isEnabled = $settings['enable_member_library'] ?? true;

        if (!$isEnabled) {
            return response()->json([
                'enabled' => false,
                'message' => 'The exercise video library is currently disabled by your gym.',
                'categories' => [],
                'exercises' => [],
            ]);
        }

        $search = $request->query('search');
        $muscleGroup = $request->query('muscle_group');
        $equipment = $request->query('equipment');

        $query = Exercise::withoutGlobalScopes()
            ->with(['categories', 'defaultVideo'])
            ->where('is_active', true)
            ->orderBy('name');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('name_mr', 'like', "%{$search}%")
                    ->orWhere('name_hi', 'like', "%{$search}%")
                    ->orWhere('target_muscle_group', 'like', "%{$search}%");
            });
        }

        if ($muscleGroup) {
            $query->where(function ($q) use ($muscleGroup) {
                $q->where('category', $muscleGroup)
                    ->orWhereHas('categories', function ($cq) use ($muscleGroup) {
                        $cq->where('slug', $muscleGroup);
                    });
            });
        }

        if ($equipment) {
            $query->where('equipment_required', $equipment);
        }

        $exercises = $query->take(100)->get();
        $resolver = app(ExerciseVideoResolverService::class);

        $results = $exercises->map(function ($exercise) use ($resolver, $member) {
            $resolved = $resolver->resolveExerciseVideo($exercise->id, $member->gym_id);
            return [
                'id' => $exercise->id,
                'name' => $exercise->name,
                'name_mr' => $exercise->name_mr,
                'name_hi' => $exercise->name_hi,
                'code' => $exercise->code,
                'category' => $exercise->category,
                'target_muscle_group' => $exercise->target_muscle_group,
                'exercise_type' => $exercise->exercise_type,
                'equipment_required' => $exercise->equipment_required,
                'difficulty_level' => $exercise->difficulty_level,
                'instructions' => $exercise->instructions,
                'common_mistakes' => $exercise->common_mistakes,
                'safety_notes' => $exercise->safety_notes,
                'resolved_video' => $resolved,
            ];
        });

        $categories = ExerciseCategory::where('is_active', true)->orderBy('sort_order')->get();

        return response()->json([
            'enabled' => true,
            'categories' => $categories,
            'exercises' => $results,
        ]);
    }
}
