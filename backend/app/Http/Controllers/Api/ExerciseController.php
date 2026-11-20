<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DietTemplate;
use App\Models\Exercise;
use App\Models\Food;
use App\Models\WorkoutTemplate;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class ExerciseController extends Controller
{
    /**
     * Get Exercise Library with category and equipment filtering.
     */
    public function index(Request $request)
    {
        $query = Exercise::query()->where('is_active', true);

        if ($request->filled('category') && $request->query('category') !== 'all') {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('equipment') && $request->query('equipment') !== 'all') {
            $query->where('equipment_required', $request->query('equipment'));
        }

        if ($request->filled('difficulty')) {
            $query->where('difficulty_level', $request->query('difficulty'));
        }

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('name_mr', 'like', "%{$s}%")
                  ->orWhere('name_hi', 'like', "%{$s}%")
                  ->orWhere('target_muscle_group', 'like', "%{$s}%");
            });
        }

        $exercises = $query->orderBy('category')->orderBy('name')->get();

        return response()->json([
            'exercises' => $exercises,
            'categories' => [
                'chest',
                'back',
                'shoulders',
                'biceps',
                'triceps',
                'legs',
                'core',
                'cardio',
                'full_body',
                'mobility',
            ],
            'equipment_types' => [
                'barbell',
                'dumbbell',
                'cable',
                'machine',
                'bodyweight',
                'kettlebell',
                'resistance_band',
            ],
        ]);
    }

    /**
     * Store custom exercise for this gym.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role === 'receptionist') {
            return response()->json(['message' => 'Unauthorized. Receptionists cannot modify fitness library.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'name_mr' => 'nullable|string|max:150',
            'name_hi' => 'nullable|string|max:150',
            'category' => 'required|string|in:chest,back,shoulders,biceps,triceps,legs,core,cardio,full_body,mobility',
            'target_muscle_group' => 'nullable|string|max:100',
            'equipment_required' => 'required|string|max:60',
            'difficulty_level' => 'required|string|in:beginner,intermediate,advanced',
            'instructions' => 'nullable|string',
            'common_mistakes' => 'nullable|string',
            'safety_notes' => 'nullable|string',
            'default_sets' => 'nullable|integer|min:1|max:10',
            'default_reps' => 'nullable|string|max:30',
            'default_rest_seconds' => 'nullable|integer|min:0|max:600',
            'image_url' => 'nullable|string|max:255',
            'video_url' => 'nullable|string|max:255',
        ]);

        $exercise = Exercise::create([
            'gym_id' => CurrentGym::require(),
            'name' => $validated['name'],
            'name_mr' => $validated['name_mr'] ?? null,
            'name_hi' => $validated['name_hi'] ?? null,
            'category' => $validated['category'],
            'target_muscle_group' => $validated['target_muscle_group'] ?? null,
            'equipment_required' => $validated['equipment_required'],
            'difficulty_level' => $validated['difficulty_level'],
            'instructions' => $validated['instructions'] ?? null,
            'common_mistakes' => $validated['common_mistakes'] ?? null,
            'safety_notes' => $validated['safety_notes'] ?? null,
            'default_sets' => $validated['default_sets'] ?? 3,
            'default_reps' => $validated['default_reps'] ?? '10-12',
            'default_rest_seconds' => $validated['default_rest_seconds'] ?? 60,
            'image_url' => $validated['image_url'] ?? null,
            'video_url' => $validated['video_url'] ?? null,
            'is_system' => false,
            'is_active' => true,
        ]);

        AuditLog::record('exercise.created', ['exercise_id' => $exercise->id, 'name' => $exercise->name]);

        return response()->json([
            'message' => 'Custom exercise added to gym library successfully',
            'exercise' => $exercise,
        ], 201);
    }

    /**
     * Show exercise details.
     */
    public function show($id)
    {
        $exercise = Exercise::findOrFail($id);

        return response()->json([
            'exercise' => $exercise,
        ]);
    }

    /**
     * List ready-made workout templates.
     */
    public function workoutTemplates(Request $request)
    {
        $query = WorkoutTemplate::query()->where('is_active', true);

        if ($request->filled('goal') && $request->query('goal') !== 'all') {
            $query->where('goal', $request->query('goal'));
        }

        if ($request->filled('difficulty')) {
            $query->where('difficulty', $request->query('difficulty'));
        }

        $templates = $query->latest('id')->get();

        return response()->json([
            'templates' => $templates,
        ]);
    }

    /**
     * Store custom workout template.
     */
    public function storeWorkoutTemplate(Request $request)
    {
        $user = $request->user();
        if ($user->role === 'receptionist') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:150',
            'goal' => 'required|string|max:60',
            'difficulty' => 'required|string|in:beginner,intermediate,advanced',
            'days_per_week' => 'required|integer|min:1|max:7',
            'split_type' => 'nullable|string|max:60',
            'description' => 'nullable|string',
            'schedule' => 'required|array|min:1',
        ]);

        $template = WorkoutTemplate::create([
            'gym_id' => CurrentGym::require(),
            'created_by_user_id' => $user->id,
            'title' => $validated['title'],
            'goal' => $validated['goal'],
            'difficulty' => $validated['difficulty'],
            'days_per_week' => $validated['days_per_week'],
            'split_type' => $validated['split_type'] ?? null,
            'description' => $validated['description'] ?? null,
            'schedule' => $validated['schedule'],
            'is_system' => false,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Workout template saved successfully',
            'template' => $template,
        ], 201);
    }

    /**
     * List food library with category, search and dietary tag filters.
     */
    public function foods(Request $request)
    {
        $query = Food::query()->where('is_active', true);

        if ($request->filled('category') && $request->query('category') !== 'all') {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('name_mr', 'like', "%{$s}%")
                  ->orWhere('name_hi', 'like', "%{$s}%");
            });
        }

        $foods = $query->orderBy('category')->orderBy('name')->get();

        return response()->json([
            'foods' => $foods,
            'categories' => [
                'grains',
                'dairy',
                'lentils_dal',
                'poultry_meat',
                'vegetables',
                'fruits',
                'nuts_seeds',
                'supplements',
            ],
        ]);
    }

    /**
     * Store custom food item.
     */
    public function storeFood(Request $request)
    {
        $user = $request->user();
        if ($user->role === 'receptionist') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'name_mr' => 'nullable|string|max:150',
            'name_hi' => 'nullable|string|max:150',
            'serving_size' => 'required|numeric|min:0.1',
            'serving_unit' => 'required|string|max:40',
            'calories' => 'required|numeric|min:0',
            'protein_g' => 'required|numeric|min:0',
            'carbs_g' => 'required|numeric|min:0',
            'fat_g' => 'required|numeric|min:0',
            'fiber_g' => 'nullable|numeric|min:0',
            'category' => 'required|string|max:50',
            'dietary_tags' => 'nullable|array',
        ]);

        $food = Food::create([
            'gym_id' => CurrentGym::require(),
            'name' => $validated['name'],
            'name_mr' => $validated['name_mr'] ?? null,
            'name_hi' => $validated['name_hi'] ?? null,
            'serving_size' => $validated['serving_size'],
            'serving_unit' => $validated['serving_unit'],
            'calories' => $validated['calories'],
            'protein_g' => $validated['protein_g'],
            'carbs_g' => $validated['carbs_g'],
            'fat_g' => $validated['fat_g'],
            'fiber_g' => $validated['fiber_g'] ?? 0,
            'category' => $validated['category'],
            'dietary_tags' => $validated['dietary_tags'] ?? ['veg'],
            'is_system' => false,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Food item added to database successfully',
            'food' => $food,
        ], 201);
    }

    /**
     * List diet templates.
     */
    public function dietTemplates(Request $request)
    {
        $query = DietTemplate::query()->where('is_active', true);

        if ($request->filled('goal')) {
            $query->where('goal', $request->query('goal'));
        }

        if ($request->filled('preference')) {
            $query->where('dietary_preference', $request->query('preference'));
        }

        $templates = $query->latest('id')->get();

        return response()->json([
            'templates' => $templates,
        ]);
    }
}
