<?php

namespace Database\Seeders;

use App\Models\DietTemplate;
use App\Models\Exercise;
use App\Models\Food;
use App\Models\WorkoutTemplate;
use Illuminate\Database\Seeder;

class WorkoutAndNutritionSeeder extends Seeder
{
    public function run(): void
    {
        // -------------------------------------------------------------
        // 1. EXERCISE LIBRARY (35+ Standard Exercises)
        // -------------------------------------------------------------
        $exercises = [
            // Chest
            [
                'name' => 'Barbell Bench Press',
                'name_mr' => 'बार्बेल बेंच प्रेस',
                'name_hi' => 'बारबेल बेंच प्रेस',
                'category' => 'chest',
                'target_muscle_group' => 'Middle Chest & Triceps',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Lie flat on bench, grip bar slightly wider than shoulder width. Lower bar smoothly to mid-chest, then press upward to full extension without locking elbows.',
                'common_mistakes' => 'Bouncing bar off chest, flaring elbows out at 90 degrees.',
                'safety_notes' => 'Keep shoulder blades retracted and feet planted firmly on the floor.',
                'default_sets' => 4,
                'default_reps' => '8-10',
                'default_rest_seconds' => 90,
                'is_system' => true,
            ],
            [
                'name' => 'Incline Dumbbell Press',
                'name_mr' => 'इन्क्लाइन डंबेल प्रेस',
                'name_hi' => 'इन्क्लाइन डम्बल प्रेस',
                'category' => 'chest',
                'target_muscle_group' => 'Upper Chest & Front Deltoids',
                'equipment_required' => 'dumbbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Set bench to 30-45 degree incline. Press dumbbells upward with palms facing away from you, converging slightly at the top.',
                'common_mistakes' => 'Incline angle too steep (shifts tension to front deltoids).',
                'safety_notes' => 'Do not drop dumbbells abruptly; bring knees up to catch them.',
                'default_sets' => 3,
                'default_reps' => '10-12',
                'default_rest_seconds' => 60,
                'is_system' => true,
            ],
            [
                'name' => 'Cable Chest Flyes',
                'name_mr' => 'केबल चेस्ट फ्लाइज',
                'name_hi' => 'केबल चेस्ट फ्लाइज़',
                'category' => 'chest',
                'target_muscle_group' => 'Pectoralis Major (Isolation)',
                'equipment_required' => 'cable',
                'difficulty_level' => 'beginner',
                'instructions' => 'Stand midway between cable towers. With slight bend in elbows, bring handles together in front of your chest with a controlled squeezing motion.',
                'common_mistakes' => 'Bending elbows excessively, turning it into a press.',
                'safety_notes' => 'Maintain steady core and avoid hyperextending shoulders back.',
                'default_sets' => 3,
                'default_reps' => '12-15',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],
            [
                'name' => 'Standard Push-ups',
                'name_mr' => 'पुश-अप्स',
                'name_hi' => 'पुश-अप्स',
                'category' => 'chest',
                'target_muscle_group' => 'Chest, Triceps & Core',
                'equipment_required' => 'bodyweight',
                'difficulty_level' => 'beginner',
                'instructions' => 'Place hands slightly wider than shoulders. Maintain straight plank position, lower chest to inch above floor, press back up.',
                'common_mistakes' => 'Sagging hips or flared elbows.',
                'safety_notes' => 'Engage glutes and abs to protect lumbar spine.',
                'default_sets' => 3,
                'default_reps' => '15-20',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],

            // Back
            [
                'name' => 'Conventional Barbell Deadlift',
                'name_mr' => 'कन्व्हेन्शनल डेडलिफ्ट',
                'name_hi' => 'कन्वेंशनल डेडलिफ्ट',
                'category' => 'back',
                'target_muscle_group' => 'Entire Posterior Chain (Lats, Erector Spinae, Hamstrings, Glutes)',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'advanced',
                'instructions' => 'Stand with bar over mid-foot. Hinge hips back, grip bar outside legs. Push floor away, drive hips forward to stand tall.',
                'common_mistakes' => 'Rounding lower back, jerking bar off the floor.',
                'safety_notes' => 'Brace core with Valsalva maneuver. Never round thoracic or lumbar spine under heavy loads.',
                'default_sets' => 4,
                'default_reps' => '5-6',
                'default_rest_seconds' => 120,
                'is_system' => true,
            ],
            [
                'name' => 'Lat Pulldown (Wide Grip)',
                'name_mr' => 'लॅट पुलडाऊन',
                'name_hi' => 'लैट पुलडाउन',
                'category' => 'back',
                'target_muscle_group' => 'Latissimus Dorsi (Lats width)',
                'equipment_required' => 'cable',
                'difficulty_level' => 'beginner',
                'instructions' => 'Grip bar with wide overhand grip. Lean back slightly, pull bar down towards upper chest while driving elbows downward and back.',
                'common_mistakes' => 'Pulling behind neck, swinging body excessively.',
                'safety_notes' => 'Controlled eccentric return; do not allow weight stack to slam.',
                'default_sets' => 4,
                'default_reps' => '10-12',
                'default_rest_seconds' => 60,
                'is_system' => true,
            ],
            [
                'name' => 'Bent-over Barbell Row',
                'name_mr' => 'बेंट-ओव्हर बार्बेल रो',
                'name_hi' => 'बेंट-ओवर बारबेल रो',
                'category' => 'back',
                'target_muscle_group' => 'Rhomboids, Lats & Middle Traps',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Hinge torso to roughly 45 degrees. Pull bar into lower chest / upper abdomen, squeezing shoulder blades together.',
                'common_mistakes' => 'Standing upright using momentum, rounding upper back.',
                'safety_notes' => 'Keep knees softly bent and maintain neutral spine throughout.',
                'default_sets' => 3,
                'default_reps' => '8-10',
                'default_rest_seconds' => 75,
                'is_system' => true,
            ],
            [
                'name' => 'Seated Cable Row',
                'name_mr' => 'सीटेड केबल रो',
                'name_hi' => 'सीटेड केबल रो',
                'category' => 'back',
                'target_muscle_group' => 'Middle Back & Lats',
                'equipment_required' => 'cable',
                'difficulty_level' => 'beginner',
                'instructions' => 'Sit upright with knees slightly bent. Pull close-grip attachment to abdomen while retracting scapulae.',
                'common_mistakes' => 'Leaning excessively forward and backward.',
                'safety_notes' => 'Keep chest proud and shoulders depressed.',
                'default_sets' => 3,
                'default_reps' => '10-12',
                'default_rest_seconds' => 60,
                'is_system' => true,
            ],

            // Shoulders
            [
                'name' => 'Overhead Barbell Military Press',
                'name_mr' => 'ओव्हरहेड बार्बेल प्रेस',
                'name_hi' => 'ओवरहेड बारबेल प्रेस',
                'category' => 'shoulders',
                'target_muscle_group' => 'Anterior & Lateral Deltoids',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Hold bar at clavicle level with upright stance. Press overhead in vertical line, locking out overhead with core engaged.',
                'common_mistakes' => 'Arching lower back excessively, pressing bar too far forward.',
                'safety_notes' => 'Squeeze glutes and quads to create stable base.',
                'default_sets' => 4,
                'default_reps' => '6-8',
                'default_rest_seconds' => 90,
                'is_system' => true,
            ],
            [
                'name' => 'Dumbbell Lateral Raise',
                'name_mr' => 'डंबेल लॅटरल रेज',
                'name_hi' => 'डम्बल लैटरल रेज़',
                'category' => 'shoulders',
                'target_muscle_group' => 'Lateral Deltoids (Shoulder width)',
                'equipment_required' => 'dumbbell',
                'difficulty_level' => 'beginner',
                'instructions' => 'Stand tall with dumbbells at sides. Raise arms out to parallel with floor, leading with elbows and slight pinky-up tilt.',
                'common_mistakes' => 'Shrugging traps, using body swing with heavy weight.',
                'safety_notes' => 'Use moderate weights to protect rotator cuff.',
                'default_sets' => 4,
                'default_reps' => '12-15',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],
            [
                'name' => 'Cable Face Pulls',
                'name_mr' => 'केबल फेस पुल्स',
                'name_hi' => 'केबल फेस पुल्स',
                'category' => 'shoulders',
                'target_muscle_group' => 'Rear Deltoids & Rotator Cuff',
                'equipment_required' => 'cable',
                'difficulty_level' => 'beginner',
                'instructions' => 'Set rope at eye level. Pull rope ends toward ears, externally rotating wrists so thumbs point back at the finish.',
                'common_mistakes' => 'Pulling downwards into chest rather than face.',
                'safety_notes' => 'Essential exercise for posture and shoulder joint longevity.',
                'default_sets' => 3,
                'default_reps' => '15',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],

            // Biceps & Triceps
            [
                'name' => 'Barbell Bicep Curl',
                'name_mr' => 'बार्बेल बायसेप कर्ल',
                'name_hi' => 'बारबेल बाइसेप कर्ल',
                'category' => 'biceps',
                'target_muscle_group' => 'Biceps Brachii',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'beginner',
                'instructions' => 'Stand tall, elbows tucked to sides. Curl bar up towards chest without swinging torso, then lower with 2-second eccentric control.',
                'common_mistakes' => 'Swinging back and forth to heave weight up.',
                'safety_notes' => 'Keep elbows pinned to ribcage.',
                'default_sets' => 3,
                'default_reps' => '10-12',
                'default_rest_seconds' => 60,
                'is_system' => true,
            ],
            [
                'name' => 'Dumbbell Hammer Curl',
                'name_mr' => 'डंबेल हॅमर कर्ल',
                'name_hi' => 'डम्बल हैमर कर्ल',
                'category' => 'biceps',
                'target_muscle_group' => 'Brachialis & Forearms',
                'equipment_required' => 'dumbbell',
                'difficulty_level' => 'beginner',
                'instructions' => 'Hold dumbbells with neutral grip (palms facing each other). Curl upward, squeezing brachialis at top.',
                'common_mistakes' => 'Rotating wrists during curl.',
                'safety_notes' => 'Controls wrist strain compared to straight bar.',
                'default_sets' => 3,
                'default_reps' => '10-12',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],
            [
                'name' => 'Tricep Rope Pushdown',
                'name_mr' => 'ट्रायसेप रोप पुशडाऊन',
                'name_hi' => 'ट्राइसेप रोप पुशडाउन',
                'category' => 'triceps',
                'target_muscle_group' => 'Triceps Lateral & Medial Head',
                'equipment_required' => 'cable',
                'difficulty_level' => 'beginner',
                'instructions' => 'Attach rope to high pulley. Keep elbows tight to ribs, push rope down and spread ends apart at bottom for peak contraction.',
                'common_mistakes' => 'Letting elbows drift forward and up on the negative.',
                'safety_notes' => 'Keep torso stationary and wrists firm.',
                'default_sets' => 3,
                'default_reps' => '12-15',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],
            [
                'name' => 'Skull Crushers (EZ Bar Lying Extension)',
                'name_mr' => 'स्कल क्रशर्स',
                'name_hi' => 'स्कल क्रशर्स',
                'category' => 'triceps',
                'target_muscle_group' => 'Triceps Long Head',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Lie on bench holding EZ bar above forehead. Lower bar toward crown of head by bending at elbows, then press back up.',
                'common_mistakes' => 'Flaring elbows outward, dropping bar too close to face.',
                'safety_notes' => 'Always use collar clips on EZ bar.',
                'default_sets' => 3,
                'default_reps' => '10-12',
                'default_rest_seconds' => 60,
                'is_system' => true,
            ],

            // Legs
            [
                'name' => 'Barbell Back Squat',
                'name_mr' => 'बार्बेल बॅक स्क्वॉट',
                'name_hi' => 'बारबेल बैक स्क्वाट',
                'category' => 'legs',
                'target_muscle_group' => 'Quadriceps, Glutes, Adductors & Core',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Rest bar securely on traps. Squat down until thighs are parallel to floor or below. Drive through mid-foot to stand up.',
                'common_mistakes' => 'Knees caving inward (valgus collapse), heel lift.',
                'safety_notes' => 'Always set safety spotter arms in squat rack.',
                'default_sets' => 4,
                'default_reps' => '6-8',
                'default_rest_seconds' => 90,
                'is_system' => true,
            ],
            [
                'name' => 'Leg Press 45-Degree',
                'name_mr' => 'लेग प्रेस',
                'name_hi' => 'लेग प्रेस',
                'category' => 'legs',
                'target_muscle_group' => 'Quadriceps & Glutes',
                'equipment_required' => 'machine',
                'difficulty_level' => 'beginner',
                'instructions' => 'Sit in 45-degree sled machine. Place feet shoulder-width on platform. Lower sled until knees reach 90 degrees, press platform back up.',
                'common_mistakes' => 'Locking knees hyperextended at the top, lifting lower back off seat pad.',
                'safety_notes' => 'Never lock knees at full extension under heavy loads.',
                'default_sets' => 4,
                'default_reps' => '10-12',
                'default_rest_seconds' => 75,
                'is_system' => true,
            ],
            [
                'name' => 'Romanian Deadlift (RDL)',
                'name_mr' => 'रोमेनियन डेडलिफ्ट',
                'name_hi' => 'रोमानियाई डेडलिफ्ट',
                'category' => 'legs',
                'target_muscle_group' => 'Hamstrings & Glutes',
                'equipment_required' => 'barbell',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Stand tall holding bar. With soft knee bend, hinge hips backward, lowering bar along shins until hamstrings are fully stretched. Drive hips forward to lockout.',
                'common_mistakes' => 'Squatting down instead of hip hinging, rounding lower back.',
                'safety_notes' => 'Keep bar close to legs throughout movement.',
                'default_sets' => 3,
                'default_reps' => '10-12',
                'default_rest_seconds' => 75,
                'is_system' => true,
            ],
            [
                'name' => 'Lying Leg Curl',
                'name_mr' => 'लाइंग लेग कर्ल',
                'name_hi' => 'लाइंग लेग कर्ल',
                'category' => 'legs',
                'target_muscle_group' => 'Hamstrings Isolation',
                'equipment_required' => 'machine',
                'difficulty_level' => 'beginner',
                'instructions' => 'Lie face down with roller pad positioned just below calf muscles. Curl legs upward towards glutes, hold briefly, then lower slowly.',
                'common_mistakes' => 'Lifting hips off bench to cheat weight.',
                'safety_notes' => 'Control the eccentric downward phase.',
                'default_sets' => 3,
                'default_reps' => '12-15',
                'default_rest_seconds' => 60,
                'is_system' => true,
            ],
            [
                'name' => 'Standing Calf Raises',
                'name_mr' => 'स्टँडिंग काल्फ रेजेस',
                'name_hi' => 'स्टैंडिंग काफ़ रेज़ेज़',
                'category' => 'legs',
                'target_muscle_group' => 'Gastrocnemius (Calves)',
                'equipment_required' => 'machine',
                'difficulty_level' => 'beginner',
                'instructions' => 'Position balls of feet on step with heels hanging off. Push up onto toes as high as possible, hold peak contraction, then lower into full stretch.',
                'common_mistakes' => 'Bouncing without pausing at top and bottom.',
                'safety_notes' => 'Pause 1 full second at full stretch to eliminate Achilles bounce.',
                'default_sets' => 4,
                'default_reps' => '15-20',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],

            // Abs & Core
            [
                'name' => 'Hanging Leg Raises',
                'name_mr' => 'हँगिंग लेग रेजेस',
                'name_hi' => 'हैंगिंग लेग रेज़ेज़',
                'category' => 'core',
                'target_muscle_group' => 'Lower Abs & Hip Flexors',
                'equipment_required' => 'bodyweight',
                'difficulty_level' => 'intermediate',
                'instructions' => 'Hang from pull-up bar. Without swinging, lift straight legs upward until parallel to floor or higher, curling pelvis toward ribs.',
                'common_mistakes' => 'Using momentum or swinging back and forth.',
                'safety_notes' => 'Beginners can bend knees 90 degrees (knee tucks).',
                'default_sets' => 3,
                'default_reps' => '12-15',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],
            [
                'name' => 'Front Plank',
                'name_mr' => 'प्लँक',
                'name_hi' => 'प्लैंक',
                'category' => 'core',
                'target_muscle_group' => 'Transverse Abdominis & Deep Core Stabilizers',
                'equipment_required' => 'bodyweight',
                'difficulty_level' => 'beginner',
                'instructions' => 'Rest on forearms and toes. Keep body in rigid straight line from head to heels. Squeeze glutes and brace abdominal wall.',
                'common_mistakes' => 'Sagging hips or raising hips too high.',
                'safety_notes' => 'Breathe steadily while holding core brace.',
                'default_sets' => 3,
                'default_reps' => '45-60s',
                'default_rest_seconds' => 45,
                'is_system' => true,
            ],

            // Cardio & Mobility
            [
                'name' => 'Incline Treadmill Power Walk',
                'name_mr' => 'इन्क्लाइन ट्रेडमिल वॉक',
                'name_hi' => 'इन्क्लाइन ट्रेडमिल वॉक',
                'category' => 'cardio',
                'target_muscle_group' => 'Cardiovascular Endurance & Glutes',
                'equipment_required' => 'machine',
                'difficulty_level' => 'beginner',
                'instructions' => 'Set treadmill incline to 10-12% and speed to 4.5-5.5 km/h. Walk at brisk pace without holding onto handrails.',
                'common_mistakes' => 'Holding tightly onto handrails (negates incline calorie burn).',
                'safety_notes' => 'Maintain upright posture with natural arm swing.',
                'default_sets' => 1,
                'default_reps' => '20-30 min',
                'default_rest_seconds' => 0,
                'is_system' => true,
            ],
            [
                'name' => 'Full Body Dynamic Mobility & Cat-Cow',
                'name_mr' => 'कॅट-काऊ आणि मोबिलिटी स्ट्रेच',
                'name_hi' => 'कैट-काउ और मोबिलिटी स्ट्रेच',
                'category' => 'mobility',
                'target_muscle_group' => 'Spine, Hips & Thoracic Mobility',
                'equipment_required' => 'bodyweight',
                'difficulty_level' => 'beginner',
                'instructions' => 'Start on hands and knees. Inhale, drop belly toward floor while lifting head (cow). Exhale, round spine upward toward ceiling (cat).',
                'common_mistakes' => 'Rushing through movements without mindful breathing.',
                'safety_notes' => 'Gentle restorative movement ideal for warmups and cooldowns.',
                'default_sets' => 2,
                'default_reps' => '10 cycles',
                'default_rest_seconds' => 30,
                'is_system' => true,
            ],
        ];

        foreach ($exercises as $ex) {
            Exercise::updateOrCreate(
                ['name' => $ex['name'], 'is_system' => true],
                $ex
            );
        }

        // -------------------------------------------------------------
        // 2. READY-MADE WORKOUT TEMPLATES
        // -------------------------------------------------------------
        $templates = [
            [
                'title' => 'Push Pull Legs (PPL) 6-Day Hypertrophy',
                'goal' => 'muscle_hypertrophy',
                'difficulty' => 'intermediate',
                'days_per_week' => 6,
                'split_type' => 'Push Pull Legs',
                'description' => 'The gold-standard bodybuilding routine targeting each muscle group twice per week with optimal recovery balance.',
                'schedule' => [
                    [
                        'day_name' => 'Monday — Push (Chest, Shoulders & Triceps)',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Barbell Bench Press', 'sets' => 4, 'reps' => '8-10', 'rest_seconds' => 90, 'target_muscle' => 'Chest'],
                            ['name' => 'Incline Dumbbell Press', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Upper Chest'],
                            ['name' => 'Dumbbell Lateral Raise', 'sets' => 4, 'reps' => '12-15', 'rest_seconds' => 45, 'target_muscle' => 'Shoulders'],
                            ['name' => 'Tricep Rope Pushdown', 'sets' => 3, 'reps' => '12-15', 'rest_seconds' => 45, 'target_muscle' => 'Triceps'],
                        ],
                    ],
                    [
                        'day_name' => 'Tuesday — Pull (Back, Rear Delts & Biceps)',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Conventional Barbell Deadlift', 'sets' => 3, 'reps' => '5', 'rest_seconds' => 120, 'target_muscle' => 'Back'],
                            ['name' => 'Lat Pulldown (Wide Grip)', 'sets' => 4, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Lats'],
                            ['name' => 'Cable Face Pulls', 'sets' => 3, 'reps' => '15', 'rest_seconds' => 45, 'target_muscle' => 'Rear Delts'],
                            ['name' => 'Barbell Bicep Curl', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Biceps'],
                        ],
                    ],
                    [
                        'day_name' => 'Wednesday — Legs & Core',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Barbell Back Squat', 'sets' => 4, 'reps' => '6-8', 'rest_seconds' => 90, 'target_muscle' => 'Quads'],
                            ['name' => 'Romanian Deadlift (RDL)', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 75, 'target_muscle' => 'Hamstrings'],
                            ['name' => 'Standing Calf Raises', 'sets' => 4, 'reps' => '15-20', 'rest_seconds' => 45, 'target_muscle' => 'Calves'],
                            ['name' => 'Front Plank', 'sets' => 3, 'reps' => '60s', 'rest_seconds' => 45, 'target_muscle' => 'Core'],
                        ],
                    ],
                    [
                        'day_name' => 'Thursday — Push 2 (Chest Focus)',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Incline Dumbbell Press', 'sets' => 4, 'reps' => '8-10', 'rest_seconds' => 75, 'target_muscle' => 'Chest'],
                            ['name' => 'Cable Chest Flyes', 'sets' => 3, 'reps' => '12-15', 'rest_seconds' => 45, 'target_muscle' => 'Chest'],
                            ['name' => 'Overhead Barbell Military Press', 'sets' => 3, 'reps' => '8-10', 'rest_seconds' => 75, 'target_muscle' => 'Shoulders'],
                            ['name' => 'Skull Crushers (EZ Bar)', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Triceps'],
                        ],
                    ],
                    [
                        'day_name' => 'Friday — Pull 2 (Upper Back & Arms)',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Bent-over Barbell Row', 'sets' => 4, 'reps' => '8-10', 'rest_seconds' => 75, 'target_muscle' => 'Upper Back'],
                            ['name' => 'Seated Cable Row', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Lats'],
                            ['name' => 'Dumbbell Hammer Curl', 'sets' => 3, 'reps' => '12', 'rest_seconds' => 45, 'target_muscle' => 'Biceps'],
                        ],
                    ],
                    [
                        'day_name' => 'Saturday — Legs 2 & Cardio Burn',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Leg Press 45-Degree', 'sets' => 4, 'reps' => '10-12', 'rest_seconds' => 75, 'target_muscle' => 'Legs'],
                            ['name' => 'Lying Leg Curl', 'sets' => 3, 'reps' => '12-15', 'rest_seconds' => 60, 'target_muscle' => 'Hamstrings'],
                            ['name' => 'Incline Treadmill Power Walk', 'sets' => 1, 'reps' => '20 min', 'rest_seconds' => 0, 'target_muscle' => 'Cardio'],
                        ],
                    ],
                    [
                        'day_name' => 'Sunday — Active Recovery & Mobility',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                ],
                'is_system' => true,
            ],
            [
                'title' => 'Beginner 3-Day Full Body Foundations',
                'goal' => 'beginner_fitness',
                'difficulty' => 'beginner',
                'days_per_week' => 3,
                'split_type' => 'Full Body',
                'description' => 'Gentle onboarding routine for first-time gym members focusing on mastering multi-joint compound movement patterns.',
                'schedule' => [
                    [
                        'day_name' => 'Monday — Full Body Foundation A',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Barbell Back Squat', 'sets' => 3, 'reps' => '8-10', 'rest_seconds' => 90, 'target_muscle' => 'Legs'],
                            ['name' => 'Barbell Bench Press', 'sets' => 3, 'reps' => '8-10', 'rest_seconds' => 90, 'target_muscle' => 'Chest'],
                            ['name' => 'Lat Pulldown (Wide Grip)', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Back'],
                            ['name' => 'Front Plank', 'sets' => 3, 'reps' => '30-45s', 'rest_seconds' => 45, 'target_muscle' => 'Core'],
                        ],
                    ],
                    [
                        'day_name' => 'Tuesday — Rest & Hydration',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                    [
                        'day_name' => 'Wednesday — Full Body Foundation B',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Romanian Deadlift (RDL)', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 75, 'target_muscle' => 'Posterior Chain'],
                            ['name' => 'Overhead Barbell Military Press', 'sets' => 3, 'reps' => '8-10', 'rest_seconds' => 75, 'target_muscle' => 'Shoulders'],
                            ['name' => 'Seated Cable Row', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Back'],
                            ['name' => 'Hanging Leg Raises', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 45, 'target_muscle' => 'Core'],
                        ],
                    ],
                    [
                        'day_name' => 'Thursday — Rest',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                    [
                        'day_name' => 'Friday — Full Body Foundation C',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Leg Press 45-Degree', 'sets' => 3, 'reps' => '12', 'rest_seconds' => 60, 'target_muscle' => 'Legs'],
                            ['name' => 'Incline Dumbbell Press', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 60, 'target_muscle' => 'Chest'],
                            ['name' => 'Barbell Bicep Curl', 'sets' => 3, 'reps' => '10-12', 'rest_seconds' => 45, 'target_muscle' => 'Biceps'],
                            ['name' => 'Tricep Rope Pushdown', 'sets' => 3, 'reps' => '12', 'rest_seconds' => 45, 'target_muscle' => 'Triceps'],
                        ],
                    ],
                    [
                        'day_name' => 'Saturday — Rest & Light Walk',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                    [
                        'day_name' => 'Sunday — Rest',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                ],
                'is_system' => true,
            ],
            [
                'title' => 'Weight Loss & Metabolic HIIT Burn (4 Days)',
                'goal' => 'weight_loss',
                'difficulty' => 'intermediate',
                'days_per_week' => 4,
                'split_type' => 'Upper / Lower + HIIT',
                'description' => 'High energy expenditure routine combining supersets of resistance training with interval cardio to maximize post-exercise oxygen consumption (EPOC).',
                'schedule' => [
                    [
                        'day_name' => 'Monday — Lower Body Power & Core',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Barbell Back Squat', 'sets' => 4, 'reps' => '10', 'rest_seconds' => 60, 'target_muscle' => 'Quads'],
                            ['name' => 'Romanian Deadlift (RDL)', 'sets' => 3, 'reps' => '12', 'rest_seconds' => 60, 'target_muscle' => 'Hamstrings'],
                            ['name' => 'Front Plank', 'sets' => 3, 'reps' => '45s', 'rest_seconds' => 30, 'target_muscle' => 'Core'],
                        ],
                    ],
                    [
                        'day_name' => 'Tuesday — Upper Body Conditioning',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Incline Dumbbell Press', 'sets' => 4, 'reps' => '12', 'rest_seconds' => 45, 'target_muscle' => 'Chest'],
                            ['name' => 'Lat Pulldown (Wide Grip)', 'sets' => 4, 'reps' => '12', 'rest_seconds' => 45, 'target_muscle' => 'Back'],
                            ['name' => 'Dumbbell Lateral Raise', 'sets' => 3, 'reps' => '15', 'rest_seconds' => 30, 'target_muscle' => 'Shoulders'],
                        ],
                    ],
                    [
                        'day_name' => 'Wednesday — Active Rest',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                    [
                        'day_name' => 'Thursday — Full Body Dynamic Circuit',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Standard Push-ups', 'sets' => 3, 'reps' => '15', 'rest_seconds' => 30, 'target_muscle' => 'Chest & Core'],
                            ['name' => 'Seated Cable Row', 'sets' => 3, 'reps' => '12', 'rest_seconds' => 45, 'target_muscle' => 'Back'],
                            ['name' => 'Leg Press 45-Degree', 'sets' => 3, 'reps' => '15', 'rest_seconds' => 45, 'target_muscle' => 'Legs'],
                        ],
                    ],
                    [
                        'day_name' => 'Friday — Incline Fat Burn Cardio',
                        'is_rest_day' => false,
                        'exercises' => [
                            ['name' => 'Incline Treadmill Power Walk', 'sets' => 1, 'reps' => '30 min', 'rest_seconds' => 0, 'target_muscle' => 'Cardio'],
                            ['name' => 'Hanging Leg Raises', 'sets' => 3, 'reps' => '15', 'rest_seconds' => 45, 'target_muscle' => 'Core'],
                        ],
                    ],
                    [
                        'day_name' => 'Saturday — Rest',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                    [
                        'day_name' => 'Sunday — Rest',
                        'is_rest_day' => true,
                        'exercises' => [],
                    ],
                ],
                'is_system' => true,
            ],
        ];

        foreach ($templates as $t) {
            WorkoutTemplate::updateOrCreate(
                ['title' => $t['title'], 'is_system' => true],
                $t
            );
        }

        // -------------------------------------------------------------
        // 3. FOOD LIBRARY (40+ Indian Food Items)
        // -------------------------------------------------------------
        $foods = [
            // Grains & Breads
            ['name' => 'Whole Wheat Roti / Chapati', 'name_mr' => 'गव्हाची चपाती / पोळी', 'name_hi' => 'गेहूं की रोटी / चपाती', 'serving_size' => 1, 'serving_unit' => 'piece', 'calories' => 104, 'protein_g' => 3.1, 'carbs_g' => 20.0, 'fat_g' => 1.2, 'fiber_g' => 2.5, 'category' => 'grains', 'dietary_tags' => ['veg', 'low_fat'], 'is_system' => true],
            ['name' => 'Cooked White Rice', 'name_mr' => 'शिजवलेला भात', 'name_hi' => 'पका हुआ चावल', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 195, 'protein_g' => 4.1, 'carbs_g' => 43.0, 'fat_g' => 0.4, 'fiber_g' => 0.6, 'category' => 'grains', 'dietary_tags' => ['veg', 'gluten_free'], 'is_system' => true],
            ['name' => 'Cooked Brown Rice', 'name_mr' => 'तपकिरी भात (ब्राउन राईस)', 'name_hi' => 'ब्राउन राइस', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 165, 'protein_g' => 3.8, 'carbs_g' => 35.0, 'fat_g' => 1.4, 'fiber_g' => 2.8, 'category' => 'grains', 'dietary_tags' => ['veg', 'high_fiber', 'gluten_free'], 'is_system' => true],
            ['name' => 'Rolled Oats (Raw)', 'name_mr' => 'रोल्ड ओट्स', 'name_hi' => 'ओट्स', 'serving_size' => 50, 'serving_unit' => 'grams', 'calories' => 190, 'protein_g' => 6.5, 'carbs_g' => 33.0, 'fat_g' => 3.5, 'fiber_g' => 5.0, 'category' => 'grains', 'dietary_tags' => ['veg', 'high_fiber'], 'is_system' => true],
            ['name' => 'Kanda Poha (Savory Flattened Rice)', 'name_mr' => 'कांदे पोहे', 'name_hi' => 'कांदा पोहा', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 180, 'protein_g' => 3.5, 'carbs_g' => 32.0, 'fat_g' => 4.2, 'fiber_g' => 2.1, 'category' => 'grains', 'dietary_tags' => ['veg'], 'is_system' => true],

            // Dairy
            ['name' => 'Low-Fat Cow Milk', 'name_mr' => 'गायीचे दूध (कमी फॅट)', 'name_hi' => 'गाय का दूध', 'serving_size' => 250, 'serving_unit' => 'ml', 'calories' => 125, 'protein_g' => 8.2, 'carbs_g' => 12.0, 'fat_g' => 3.8, 'fiber_g' => 0.0, 'category' => 'dairy', 'dietary_tags' => ['veg', 'high_protein'], 'is_system' => true],
            ['name' => 'Fresh Curd / Dahi', 'name_mr' => 'घरगुती ताजे दही', 'name_hi' => 'दही', 'serving_size' => 100, 'serving_unit' => 'grams', 'calories' => 68, 'protein_g' => 3.5, 'carbs_g' => 4.2, 'fat_g' => 4.0, 'fiber_g' => 0.0, 'category' => 'dairy', 'dietary_tags' => ['veg', 'probiotic'], 'is_system' => true],
            ['name' => 'Fresh Paneer (Cottage Cheese)', 'name_mr' => 'ताजे पनीर', 'name_hi' => 'ताजा पनीर', 'serving_size' => 100, 'serving_unit' => 'grams', 'calories' => 265, 'protein_g' => 18.3, 'carbs_g' => 4.2, 'fat_g' => 20.0, 'fiber_g' => 0.0, 'category' => 'dairy', 'dietary_tags' => ['veg', 'high_protein', 'keto'], 'is_system' => true],
            ['name' => 'Low-Fat Paneer', 'name_mr' => 'लो-फॅट पनीर', 'name_hi' => 'लो-फैट पनीर', 'serving_size' => 100, 'serving_unit' => 'grams', 'calories' => 140, 'protein_g' => 25.0, 'carbs_g' => 3.0, 'fat_g' => 2.5, 'fiber_g' => 0.0, 'category' => 'dairy', 'dietary_tags' => ['veg', 'high_protein', 'lean'], 'is_system' => true],
            ['name' => 'Pure Desi Cow Ghee', 'name_mr' => 'शुद्ध देशी तूप', 'name_hi' => 'देसी घी', 'serving_size' => 15, 'serving_unit' => 'grams', 'calories' => 135, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 15.0, 'fiber_g' => 0.0, 'category' => 'dairy', 'dietary_tags' => ['veg', 'healthy_fats'], 'is_system' => true],

            // Dal & Lentils
            ['name' => 'Cooked Yellow Moong Dal', 'name_mr' => 'मूग डाळ वरण', 'name_hi' => 'मूंग दाल', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 145, 'protein_g' => 9.0, 'carbs_g' => 22.0, 'fat_g' => 2.2, 'fiber_g' => 4.5, 'category' => 'lentils_dal', 'dietary_tags' => ['veg', 'high_protein', 'easy_digest'], 'is_system' => true],
            ['name' => 'Toor Dal Tadka', 'name_mr' => 'तूर डाळ तडका', 'name_hi' => 'तूर दाल तड़का', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 165, 'protein_g' => 8.5, 'carbs_g' => 24.0, 'fat_g' => 4.0, 'fiber_g' => 5.0, 'category' => 'lentils_dal', 'dietary_tags' => ['veg', 'high_protein'], 'is_system' => true],
            ['name' => 'Boiled Chickpeas (Chana)', 'name_mr' => 'उकडलेले चणे', 'name_hi' => 'उबले हुए चने', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 180, 'protein_g' => 9.5, 'carbs_g' => 30.0, 'fat_g' => 2.8, 'fiber_g' => 7.5, 'category' => 'lentils_dal', 'dietary_tags' => ['veg', 'high_fiber', 'high_protein'], 'is_system' => true],
            ['name' => 'Moong Sprouts (Raw)', 'name_mr' => 'मोड आलेले मूग', 'name_hi' => 'मूंग स्प्राउट्स', 'serving_size' => 100, 'serving_unit' => 'grams', 'calories' => 85, 'protein_g' => 7.0, 'carbs_g' => 14.0, 'fat_g' => 0.5, 'fiber_g' => 4.0, 'category' => 'lentils_dal', 'dietary_tags' => ['veg', 'high_protein', 'superfood'], 'is_system' => true],
            ['name' => 'Boiled Rajma (Kidney Beans)', 'name_mr' => 'उकडलेला राजमा', 'name_hi' => 'उबला हुआ राजमा', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 170, 'protein_g' => 9.2, 'carbs_g' => 28.0, 'fat_g' => 1.5, 'fiber_g' => 8.0, 'category' => 'lentils_dal', 'dietary_tags' => ['veg', 'high_fiber'], 'is_system' => true],

            // Poultry, Eggs & Meat
            ['name' => 'Whole Boiled Egg', 'name_mr' => 'उकडलेले अंडे (पूर्ण)', 'name_hi' => 'उबला अंडा', 'serving_size' => 1, 'serving_unit' => 'piece', 'calories' => 74, 'protein_g' => 6.3, 'carbs_g' => 0.4, 'fat_g' => 5.0, 'fiber_g' => 0.0, 'category' => 'poultry_meat', 'dietary_tags' => ['non_veg', 'egg', 'high_protein'], 'is_system' => true],
            ['name' => 'Boiled Egg White', 'name_mr' => 'अंड्याचा पांढरा भाग', 'name_hi' => 'अंडे का सफेद भाग', 'serving_size' => 1, 'serving_unit' => 'piece', 'calories' => 17, 'protein_g' => 3.6, 'carbs_g' => 0.2, 'fat_g' => 0.1, 'fiber_g' => 0.0, 'category' => 'poultry_meat', 'dietary_tags' => ['non_veg', 'egg', 'lean_protein'], 'is_system' => true],
            ['name' => 'Grilled Chicken Breast', 'name_mr' => 'ग्रील्ड चिकन ब्रेस्ट', 'name_hi' => 'ग्रिल्ड चिकन ब्रेस्ट', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 220, 'protein_g' => 42.0, 'carbs_g' => 0.0, 'fat_g' => 4.5, 'fiber_g' => 0.0, 'category' => 'poultry_meat', 'dietary_tags' => ['non_veg', 'high_protein', 'lean'], 'is_system' => true],
            ['name' => 'Homestyle Chicken Curry', 'name_mr' => 'चिकन रस्सा / करी', 'name_hi' => 'चिकन करी', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 245, 'protein_g' => 26.0, 'carbs_g' => 6.0, 'fat_g' => 12.0, 'fiber_g' => 1.2, 'category' => 'poultry_meat', 'dietary_tags' => ['non_veg', 'high_protein'], 'is_system' => true],

            // Fruits & Vegetables
            ['name' => 'Banana (Medium)', 'name_mr' => 'केळे', 'name_hi' => 'केला', 'serving_size' => 1, 'serving_unit' => 'piece', 'calories' => 105, 'protein_g' => 1.3, 'carbs_g' => 27.0, 'fat_g' => 0.3, 'fiber_g' => 3.1, 'category' => 'fruits', 'dietary_tags' => ['veg', 'pre_workout'], 'is_system' => true],
            ['name' => 'Apple (Medium)', 'name_mr' => 'सफरचंद', 'name_hi' => 'सेब', 'serving_size' => 1, 'serving_unit' => 'piece', 'calories' => 95, 'protein_g' => 0.5, 'carbs_g' => 25.0, 'fat_g' => 0.3, 'fiber_g' => 4.4, 'category' => 'fruits', 'dietary_tags' => ['veg', 'high_fiber'], 'is_system' => true],
            ['name' => 'Boiled Sweet Potato', 'name_mr' => 'उकडलेले रताळे', 'name_hi' => 'शकरकंद', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 135, 'protein_g' => 2.4, 'carbs_g' => 31.0, 'fat_g' => 0.2, 'fiber_g' => 4.0, 'category' => 'vegetables', 'dietary_tags' => ['veg', 'clean_carbs'], 'is_system' => true],
            ['name' => 'Cucumber & Tomato Salad', 'name_mr' => 'काकडी व टोमॅटो कोशिंबीर', 'name_hi' => 'खीरा और टमाटर सलाद', 'serving_size' => 150, 'serving_unit' => 'grams', 'calories' => 35, 'protein_g' => 1.5, 'carbs_g' => 7.0, 'fat_g' => 0.3, 'fiber_g' => 2.5, 'category' => 'vegetables', 'dietary_tags' => ['veg', 'low_calorie'], 'is_system' => true],

            // Nuts & Seeds
            ['name' => 'Raw Almonds (Badam)', 'name_mr' => 'बदाम', 'name_hi' => 'बादाम', 'serving_size' => 20, 'serving_unit' => 'grams', 'calories' => 120, 'protein_g' => 4.4, 'carbs_g' => 4.2, 'fat_g' => 10.2, 'fiber_g' => 2.4, 'category' => 'nuts_seeds', 'dietary_tags' => ['veg', 'healthy_fats'], 'is_system' => true],
            ['name' => 'Roasted Peanuts', 'name_mr' => 'भाजलेले शेंगदाणे', 'name_hi' => 'भुनी हुई मूंगफली', 'serving_size' => 30, 'serving_unit' => 'grams', 'calories' => 170, 'protein_g' => 7.5, 'carbs_g' => 5.0, 'fat_g' => 14.0, 'fiber_g' => 2.5, 'category' => 'nuts_seeds', 'dietary_tags' => ['veg', 'high_protein'], 'is_system' => true],
            ['name' => 'Natural Peanut Butter', 'name_mr' => 'पीनट बटर', 'name_hi' => 'पीनट बटर', 'serving_size' => 32, 'serving_unit' => 'grams', 'calories' => 190, 'protein_g' => 8.0, 'carbs_g' => 6.0, 'fat_g' => 16.0, 'fiber_g' => 2.0, 'category' => 'nuts_seeds', 'dietary_tags' => ['veg', 'high_protein'], 'is_system' => true],

            // Supplements
            ['name' => 'Whey Protein Isolate (1 Scoop)', 'name_mr' => 'व्हे प्रोटीन आयसोलेट', 'name_hi' => 'व्हे प्रोटीन आइसोलेट', 'serving_size' => 30, 'serving_unit' => 'grams', 'calories' => 110, 'protein_g' => 27.0, 'carbs_g' => 1.0, 'fat_g' => 0.5, 'fiber_g' => 0.0, 'category' => 'supplements', 'dietary_tags' => ['veg', 'high_protein', 'post_workout'], 'is_system' => true],
        ];

        foreach ($foods as $food) {
            Food::updateOrCreate(
                ['name' => $food['name'], 'is_system' => true],
                $food
            );
        }

        // -------------------------------------------------------------
        // 4. READY-MADE DIET TEMPLATES
        // -------------------------------------------------------------
        $dietTemplates = [
            [
                'title' => 'High-Protein Muscle Gain (2400 kcal)',
                'goal' => 'muscle_gain',
                'dietary_preference' => 'non_vegetarian',
                'target_calories' => 2400,
                'target_protein_g' => 150,
                'target_carbs_g' => 260,
                'target_fat_g' => 65,
                'meals' => [
                    [
                        'slot' => 'breakfast',
                        'time' => '08:30 AM',
                        'slot_title' => 'Power Breakfast',
                        'items' => [
                            ['name' => 'Rolled Oats (Raw)', 'quantity' => 60, 'unit' => 'grams', 'calories' => 228, 'protein' => 7.8, 'carbs' => 39.6, 'fat' => 4.2],
                            ['name' => 'Low-Fat Cow Milk', 'quantity' => 250, 'unit' => 'ml', 'calories' => 125, 'protein' => 8.2, 'carbs' => 12.0, 'fat' => 3.8],
                            ['name' => 'Banana (Medium)', 'quantity' => 1, 'unit' => 'piece', 'calories' => 105, 'protein' => 1.3, 'carbs' => 27.0, 'fat' => 0.3],
                            ['name' => 'Whole Boiled Egg', 'quantity' => 2, 'unit' => 'piece', 'calories' => 148, 'protein' => 12.6, 'carbs' => 0.8, 'fat' => 10.0],
                        ],
                    ],
                    [
                        'slot' => 'mid_morning',
                        'time' => '11:30 AM',
                        'slot_title' => 'Mid-Morning Fuel',
                        'items' => [
                            ['name' => 'Moong Sprouts (Raw)', 'quantity' => 100, 'unit' => 'grams', 'calories' => 85, 'protein' => 7.0, 'carbs' => 14.0, 'fat' => 0.5],
                            ['name' => 'Apple (Medium)', 'quantity' => 1, 'unit' => 'piece', 'calories' => 95, 'protein' => 0.5, 'carbs' => 25.0, 'fat' => 0.3],
                        ],
                    ],
                    [
                        'slot' => 'lunch',
                        'time' => '01:30 PM',
                        'slot_title' => 'Nutritious High-Protein Lunch',
                        'items' => [
                            ['name' => 'Whole Wheat Roti / Chapati', 'quantity' => 2, 'unit' => 'piece', 'calories' => 208, 'protein' => 6.2, 'carbs' => 40.0, 'fat' => 2.4],
                            ['name' => 'Grilled Chicken Breast', 'quantity' => 150, 'unit' => 'grams', 'calories' => 220, 'protein' => 42.0, 'carbs' => 0.0, 'fat' => 4.5],
                            ['name' => 'Cooked Yellow Moong Dal', 'quantity' => 150, 'unit' => 'grams', 'calories' => 145, 'protein' => 9.0, 'carbs' => 22.0, 'fat' => 2.2],
                            ['name' => 'Cucumber & Tomato Salad', 'quantity' => 150, 'unit' => 'grams', 'calories' => 35, 'protein' => 1.5, 'carbs' => 7.0, 'fat' => 0.3],
                        ],
                    ],
                    [
                        'slot' => 'pre_workout',
                        'time' => '05:30 PM',
                        'slot_title' => 'Pre-Workout Energy',
                        'items' => [
                            ['name' => 'Banana (Medium)', 'quantity' => 1, 'unit' => 'piece', 'calories' => 105, 'protein' => 1.3, 'carbs' => 27.0, 'fat' => 0.3],
                            ['name' => 'Natural Peanut Butter', 'quantity' => 20, 'unit' => 'grams', 'calories' => 118, 'protein' => 5.0, 'carbs' => 3.7, 'fat' => 10.0],
                        ],
                    ],
                    [
                        'slot' => 'post_workout',
                        'time' => '07:30 PM',
                        'slot_title' => 'Post-Workout Recovery',
                        'items' => [
                            ['name' => 'Whey Protein Isolate (1 Scoop)', 'quantity' => 30, 'unit' => 'grams', 'calories' => 110, 'protein' => 27.0, 'carbs' => 1.0, 'fat' => 0.5],
                        ],
                    ],
                    [
                        'slot' => 'dinner',
                        'time' => '09:00 PM',
                        'slot_title' => 'Lean Dinner',
                        'items' => [
                            ['name' => 'Cooked Brown Rice', 'quantity' => 150, 'unit' => 'grams', 'calories' => 165, 'protein' => 3.8, 'carbs' => 35.0, 'fat' => 1.4],
                            ['name' => 'Boiled Egg White', 'quantity' => 4, 'unit' => 'piece', 'calories' => 68, 'protein' => 14.4, 'carbs' => 0.8, 'fat' => 0.4],
                            ['name' => 'Cooked Yellow Moong Dal', 'quantity' => 150, 'unit' => 'grams', 'calories' => 145, 'protein' => 9.0, 'carbs' => 22.0, 'fat' => 2.2],
                        ],
                    ],
                ],
                'is_system' => true,
            ],
            [
                'title' => 'Vegetarian High-Protein & Fat Loss (1750 kcal)',
                'goal' => 'fat_loss',
                'dietary_preference' => 'vegetarian',
                'target_calories' => 1750,
                'target_protein_g' => 115,
                'target_carbs_g' => 180,
                'target_fat_g' => 45,
                'meals' => [
                    [
                        'slot' => 'breakfast',
                        'time' => '08:30 AM',
                        'slot_title' => 'Sprouts & Milk Morning',
                        'items' => [
                            ['name' => 'Moong Sprouts (Raw)', 'quantity' => 150, 'unit' => 'grams', 'calories' => 127, 'protein' => 10.5, 'carbs' => 21.0, 'fat' => 0.7],
                            ['name' => 'Low-Fat Cow Milk', 'quantity' => 250, 'unit' => 'ml', 'calories' => 125, 'protein' => 8.2, 'carbs' => 12.0, 'fat' => 3.8],
                            ['name' => 'Raw Almonds (Badam)', 'quantity' => 15, 'unit' => 'grams', 'calories' => 90, 'protein' => 3.3, 'carbs' => 3.1, 'fat' => 7.6],
                        ],
                    ],
                    [
                        'slot' => 'lunch',
                        'time' => '01:30 PM',
                        'slot_title' => 'Paneer & Roti Power Lunch',
                        'items' => [
                            ['name' => 'Whole Wheat Roti / Chapati', 'quantity' => 2, 'unit' => 'piece', 'calories' => 208, 'protein' => 6.2, 'carbs' => 40.0, 'fat' => 2.4],
                            ['name' => 'Fresh Paneer (Cottage Cheese)', 'quantity' => 100, 'unit' => 'grams', 'calories' => 265, 'protein' => 18.3, 'carbs' => 4.2, 'fat' => 20.0],
                            ['name' => 'Cooked Yellow Moong Dal', 'quantity' => 150, 'unit' => 'grams', 'calories' => 145, 'protein' => 9.0, 'carbs' => 22.0, 'fat' => 2.2],
                            ['name' => 'Cucumber & Tomato Salad', 'quantity' => 150, 'unit' => 'grams', 'calories' => 35, 'protein' => 1.5, 'carbs' => 7.0, 'fat' => 0.3],
                        ],
                    ],
                    [
                        'slot' => 'evening_snack',
                        'time' => '05:30 PM',
                        'slot_title' => 'Evening Refuel',
                        'items' => [
                            ['name' => 'Boiled Chickpeas (Chana)', 'quantity' => 100, 'unit' => 'grams', 'calories' => 120, 'protein' => 6.3, 'carbs' => 20.0, 'fat' => 1.9],
                            ['name' => 'Fresh Curd / Dahi', 'quantity' => 100, 'unit' => 'grams', 'calories' => 68, 'protein' => 3.5, 'carbs' => 4.2, 'fat' => 4.0],
                        ],
                    ],
                    [
                        'slot' => 'post_workout',
                        'time' => '07:30 PM',
                        'slot_title' => 'Recovery Shake',
                        'items' => [
                            ['name' => 'Whey Protein Isolate (1 Scoop)', 'quantity' => 30, 'unit' => 'grams', 'calories' => 110, 'protein' => 27.0, 'carbs' => 1.0, 'fat' => 0.5],
                        ],
                    ],
                    [
                        'slot' => 'dinner',
                        'time' => '09:00 PM',
                        'slot_title' => 'Light Clean Dinner',
                        'items' => [
                            ['name' => 'Whole Wheat Roti / Chapati', 'quantity' => 1, 'unit' => 'piece', 'calories' => 104, 'protein' => 3.1, 'carbs' => 20.0, 'fat' => 1.2],
                            ['name' => 'Boiled Rajma (Kidney Beans)', 'quantity' => 150, 'unit' => 'grams', 'calories' => 170, 'protein' => 9.2, 'carbs' => 28.0, 'fat' => 1.5],
                            ['name' => 'Cucumber & Tomato Salad', 'quantity' => 150, 'unit' => 'grams', 'calories' => 35, 'protein' => 1.5, 'carbs' => 7.0, 'fat' => 0.3],
                        ],
                    ],
                ],
                'is_system' => true,
            ],
        ];

        foreach ($dietTemplates as $dt) {
            DietTemplate::updateOrCreate(
                ['title' => $dt['title'], 'is_system' => true],
                $dt
            );
        }
    }
}
