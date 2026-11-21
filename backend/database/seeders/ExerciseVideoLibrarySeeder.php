<?php

namespace Database\Seeders;

use App\Models\Exercise;
use App\Models\ExerciseCategory;
use App\Models\ExerciseVideo;
use App\Models\VideoProvider;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ExerciseVideoLibrarySeeder extends Seeder
{
    public function run(): void
    {
        // ---------------------------------------------------------------------
        // 1. VIDEO PROVIDERS
        // ---------------------------------------------------------------------
        $providers = [
            [
                'name' => 'YouTube',
                'code' => 'youtube',
                'supports_embed' => true,
                'supports_upload' => false,
                'is_enabled' => true,
                'commercial_terms_notes' => 'Official YouTube IFrame Player API. Privacy-enhanced embed mode (youtube-nocookie.com). Adheres to YouTube terms of service.',
                'config' => [
                    'embed_template' => 'https://www.youtube-nocookie.com/embed/{video_id}?rel=0&modestbranding=1&enablejsapi=1',
                    'allowed_domains' => ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
                ],
            ],
            [
                'name' => 'Direct Video Upload',
                'code' => 'custom_upload',
                'supports_embed' => false,
                'supports_upload' => true,
                'is_enabled' => true,
                'commercial_terms_notes' => 'Direct local or cloud storage for original or licensed MP4/WebM files.',
                'config' => [
                    'allowed_extensions' => ['mp4', 'webm'],
                    'max_size_mb' => 100,
                ],
            ],
            [
                'name' => 'Vimeo',
                'code' => 'vimeo',
                'supports_embed' => true,
                'supports_upload' => false,
                'is_enabled' => false,
                'commercial_terms_notes' => 'Optional Vimeo Pro player integration.',
                'config' => [
                    'embed_template' => 'https://player.vimeo.com/video/{video_id}?dnt=1',
                ],
            ],
        ];

        foreach ($providers as $prov) {
            VideoProvider::updateOrCreate(['code' => $prov['code']], $prov);
        }

        // ---------------------------------------------------------------------
        // 2. STRUCTURED CATEGORIES
        // ---------------------------------------------------------------------
        $categories = [
            // Muscle Groups
            ['name' => 'Chest', 'name_mr' => 'छाती', 'name_hi' => 'सीना', 'slug' => 'chest', 'type' => 'muscle_group', 'sort_order' => 1],
            ['name' => 'Back', 'name_mr' => 'पाठ', 'name_hi' => 'पीठ', 'slug' => 'back', 'type' => 'muscle_group', 'sort_order' => 2],
            ['name' => 'Shoulders', 'name_mr' => 'खांदे', 'name_hi' => 'कंधे', 'slug' => 'shoulders', 'type' => 'muscle_group', 'sort_order' => 3],
            ['name' => 'Biceps', 'name_mr' => 'बायसेप्स', 'name_hi' => 'बाइसेप्स', 'slug' => 'biceps', 'type' => 'muscle_group', 'sort_order' => 4],
            ['name' => 'Triceps', 'name_mr' => 'ट्रायसेप्स', 'name_hi' => 'ट्राइसेप्स', 'slug' => 'triceps', 'type' => 'muscle_group', 'sort_order' => 5],
            ['name' => 'Forearms', 'name_mr' => 'फोरआर्म्स', 'name_hi' => 'फोरआर्म्स', 'slug' => 'forearms', 'type' => 'muscle_group', 'sort_order' => 6],
            ['name' => 'Legs', 'name_mr' => 'पाय', 'name_hi' => 'पैर', 'slug' => 'legs', 'type' => 'muscle_group', 'sort_order' => 7],
            ['name' => 'Glutes', 'name_mr' => 'ग्लूट्स', 'name_hi' => 'ग्लूट्स', 'slug' => 'glutes', 'type' => 'muscle_group', 'sort_order' => 8],
            ['name' => 'Abs and Core', 'name_mr' => 'पोटाचे स्नायू व कोअर', 'name_hi' => 'एब्स और कोर', 'slug' => 'abs_core', 'type' => 'muscle_group', 'sort_order' => 9],
            ['name' => 'Full Body', 'name_mr' => 'संपूर्ण शरीर', 'name_hi' => 'पूरा शरीर', 'slug' => 'full_body', 'type' => 'muscle_group', 'sort_order' => 10],

            // Exercise Types
            ['name' => 'Strength Training', 'name_mr' => 'ताकद प्रशिक्षण', 'name_hi' => 'शक्ति प्रशिक्षण', 'slug' => 'strength', 'type' => 'exercise_type', 'sort_order' => 11],
            ['name' => 'Cardio', 'name_mr' => 'कार्डिओ', 'name_hi' => 'कार्डियो', 'slug' => 'cardio', 'type' => 'exercise_type', 'sort_order' => 12],
            ['name' => 'Functional Training', 'name_mr' => 'कार्यात्मक व्यायाम', 'name_hi' => 'कार्यात्मक प्रशिक्षण', 'slug' => 'functional', 'type' => 'exercise_type', 'sort_order' => 13],
            ['name' => 'Mobility', 'name_mr' => 'हालचाल क्षमता', 'name_hi' => 'गतिशीलता', 'slug' => 'mobility', 'type' => 'exercise_type', 'sort_order' => 14],
            ['name' => 'Stretching', 'name_mr' => 'स्ट्रेचिंग', 'name_hi' => 'स्ट्रेचिंग', 'slug' => 'stretching', 'type' => 'exercise_type', 'sort_order' => 15],
            ['name' => 'Warm-up', 'name_mr' => 'वॉर्म-अप', 'name_hi' => 'वार्म-अप', 'slug' => 'warmup', 'type' => 'exercise_type', 'sort_order' => 16],
            ['name' => 'Cool-down', 'name_mr' => 'कूल-डाउन', 'name_hi' => 'कूल-डाउन', 'slug' => 'cooldown', 'type' => 'exercise_type', 'sort_order' => 17],
            ['name' => 'Bodyweight', 'name_mr' => 'शरीराचे वजन', 'name_hi' => 'बॉडीवेट', 'slug' => 'bodyweight_type', 'type' => 'exercise_type', 'sort_order' => 18],
            ['name' => 'Resistance Training', 'name_mr' => 'प्रतिरोध व्यायाम', 'name_hi' => 'प्रतिरोध प्रशिक्षण', 'slug' => 'resistance', 'type' => 'exercise_type', 'sort_order' => 19],

            // Equipment
            ['name' => 'Dumbbells', 'name_mr' => 'डंबेल', 'name_hi' => 'डम्बल', 'slug' => 'dumbbells', 'type' => 'equipment', 'sort_order' => 20],
            ['name' => 'Barbells', 'name_mr' => 'बार्बेल', 'name_hi' => 'बारबेल', 'slug' => 'barbells', 'type' => 'equipment', 'sort_order' => 21],
            ['name' => 'Cable Machines', 'name_mr' => 'केबल मशीन', 'name_hi' => 'केबल मशीनें', 'slug' => 'cable_machines', 'type' => 'equipment', 'sort_order' => 22],
            ['name' => 'Resistance Bands', 'name_mr' => 'रेझिस्टन्स बँड्स', 'name_hi' => 'रेजिस्टेंस बैंड', 'slug' => 'resistance_bands', 'type' => 'equipment', 'sort_order' => 23],
            ['name' => 'Smith Machine', 'name_mr' => 'स्मिथ मशीन', 'name_hi' => 'स्मिथ मशीन', 'slug' => 'smith_machine', 'type' => 'equipment', 'sort_order' => 24],
            ['name' => 'Kettlebells', 'name_mr' => 'केटलबेल्स', 'name_hi' => 'केटलबेल', 'slug' => 'kettlebells', 'type' => 'equipment', 'sort_order' => 25],
            ['name' => 'Machines', 'name_mr' => 'मशिन्स', 'name_hi' => 'मशीनें', 'slug' => 'machines', 'type' => 'equipment', 'sort_order' => 26],
            ['name' => 'Bodyweight', 'name_mr' => 'उपकरण नाही (बॉडीवेट)', 'name_hi' => 'उपकरण नहीं (बॉडीवेट)', 'slug' => 'bodyweight_eq', 'type' => 'equipment', 'sort_order' => 27],
            ['name' => 'Other Equipment', 'name_mr' => 'इतर उपकरणे', 'name_hi' => 'अन्य उपकरण', 'slug' => 'other_equipment', 'type' => 'equipment', 'sort_order' => 28],
        ];

        $categoryMap = [];
        foreach ($categories as $cat) {
            $created = ExerciseCategory::updateOrCreate(['slug' => $cat['slug']], $cat);
            $categoryMap[$cat['slug']] = $created->id;
        }

        // ---------------------------------------------------------------------
        // 3. CURATED PLATFORM GLOBAL VIDEOS FOR CORE EXERCISES
        // ---------------------------------------------------------------------
        $globalTutorials = [
            [
                'exercise_name' => 'Barbell Bench Press',
                'code' => 'EX-CHEST-01',
                'muscle_group' => 'chest',
                'exercise_type' => 'strength',
                'equipment' => 'barbells',
                'youtube_id' => 'rT7DgCr-3pg',
                'title' => 'How To Properly Barbell Bench Press (Step By Step Guide)',
                'creator' => 'Scott Herman Fitness',
                'channel' => 'ScottHermanFitness',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 315,
                'difficulty_level' => 'intermediate',
            ],
            [
                'exercise_name' => 'Incline Dumbbell Press',
                'code' => 'EX-CHEST-02',
                'muscle_group' => 'chest',
                'exercise_type' => 'strength',
                'equipment' => 'dumbbells',
                'youtube_id' => '8iPEnn-ltC8',
                'title' => 'How To Incline Dumbbell Bench Press Properly',
                'creator' => 'Buff Dudes',
                'channel' => 'BuffDudes',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 280,
                'difficulty_level' => 'intermediate',
            ],
            [
                'exercise_name' => 'Cable Chest Flyes',
                'code' => 'EX-CHEST-03',
                'muscle_group' => 'chest',
                'exercise_type' => 'strength',
                'equipment' => 'cable_machines',
                'youtube_id' => 'Iwe6AmxVf7o',
                'title' => 'Standing Cable Fly (Chest Isolation Tutorial)',
                'creator' => 'Scott Herman Fitness',
                'channel' => 'ScottHermanFitness',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 240,
                'difficulty_level' => 'beginner',
            ],
            [
                'exercise_name' => 'Standard Push-ups',
                'code' => 'EX-CHEST-04',
                'muscle_group' => 'chest',
                'exercise_type' => 'bodyweight_type',
                'equipment' => 'bodyweight_eq',
                'youtube_id' => 'IODxDxX7oi4',
                'title' => 'How To Do The Perfect Push-Up',
                'creator' => 'Calisthenicmovement',
                'channel' => 'Calisthenicmovement',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 295,
                'difficulty_level' => 'beginner',
            ],
            [
                'exercise_name' => 'Conventional Barbell Deadlift',
                'code' => 'EX-BACK-01',
                'muscle_group' => 'back',
                'exercise_type' => 'strength',
                'equipment' => 'barbells',
                'youtube_id' => 'op9kVnSso6Q',
                'title' => 'How To Deadlift: 5 Step Guide by Alan Thrall',
                'creator' => 'Alan Thrall',
                'channel' => 'UntamedStrength',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 420,
                'difficulty_level' => 'advanced',
            ],
            [
                'exercise_name' => 'Lat Pulldown (Wide Grip)',
                'code' => 'EX-BACK-02',
                'muscle_group' => 'back',
                'exercise_type' => 'strength',
                'equipment' => 'cable_machines',
                'youtube_id' => 'CAwf7n6Luuc',
                'title' => 'How To Properly Lat Pulldown (Target Lats Width)',
                'creator' => 'Scott Herman Fitness',
                'channel' => 'ScottHermanFitness',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 250,
                'difficulty_level' => 'beginner',
            ],
            [
                'exercise_name' => 'Bent-over Barbell Row',
                'code' => 'EX-BACK-03',
                'muscle_group' => 'back',
                'exercise_type' => 'strength',
                'equipment' => 'barbells',
                'youtube_id' => 'FWJR5Ve8gkQ',
                'title' => 'How To Bent Over Barbell Row Correctly',
                'creator' => 'Buff Dudes',
                'channel' => 'BuffDudes',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 310,
                'difficulty_level' => 'intermediate',
            ],
            [
                'exercise_name' => 'Barbell Back Squat',
                'code' => 'EX-LEG-01',
                'muscle_group' => 'legs',
                'exercise_type' => 'strength',
                'equipment' => 'barbells',
                'youtube_id' => 'ultWZbUMPL8',
                'title' => 'How To Squat: Setup, Mechanics & Depth',
                'creator' => 'Alan Thrall',
                'channel' => 'UntamedStrength',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 520,
                'difficulty_level' => 'intermediate',
            ],
            [
                'exercise_name' => 'Overhead Barbell Press (OHP)',
                'code' => 'EX-SHLD-01',
                'muscle_group' => 'shoulders',
                'exercise_type' => 'strength',
                'equipment' => 'barbells',
                'youtube_id' => '2yjwXTZQDDI',
                'title' => 'How To Overhead Press with Proper Form',
                'creator' => 'Alan Thrall',
                'channel' => 'UntamedStrength',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 390,
                'difficulty_level' => 'intermediate',
            ],
            [
                'exercise_name' => 'Dumbbell Lateral Raises',
                'code' => 'EX-SHLD-02',
                'muscle_group' => 'shoulders',
                'exercise_type' => 'strength',
                'equipment' => 'dumbbells',
                'youtube_id' => '3VcKaXpzqRo',
                'title' => 'Dumbbell Side Lateral Raise (Boulder Shoulders Tutorial)',
                'creator' => 'Buff Dudes',
                'channel' => 'BuffDudes',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 260,
                'difficulty_level' => 'beginner',
            ],
            [
                'exercise_name' => 'Barbell Bicep Curl',
                'code' => 'EX-ARM-01',
                'muscle_group' => 'biceps',
                'exercise_type' => 'strength',
                'equipment' => 'barbells',
                'youtube_id' => 'kwG2ipFRgfo',
                'title' => 'How To Strict Barbell Bicep Curl',
                'creator' => 'Scott Herman Fitness',
                'channel' => 'ScottHermanFitness',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 210,
                'difficulty_level' => 'beginner',
            ],
            [
                'exercise_name' => 'Tricep Rope Pushdown',
                'code' => 'EX-ARM-02',
                'muscle_group' => 'triceps',
                'exercise_type' => 'strength',
                'equipment' => 'cable_machines',
                'youtube_id' => '-zrkJjHlTz0',
                'title' => 'Rope Tricep Extension Pushdown Technique',
                'creator' => 'Scott Herman Fitness',
                'channel' => 'ScottHermanFitness',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 195,
                'difficulty_level' => 'beginner',
            ],
            [
                'exercise_name' => 'Standard Plank',
                'code' => 'EX-CORE-01',
                'muscle_group' => 'abs_core',
                'exercise_type' => 'bodyweight_type',
                'equipment' => 'bodyweight_eq',
                'youtube_id' => 'ASdvN_XEl_c',
                'title' => 'How To Do A Plank: Proper Core Engagement',
                'creator' => 'Bowflex',
                'channel' => 'Bowflex',
                'rights_status' => 'approved',
                'license_type' => 'Standard YouTube License (Embedding Permitted)',
                'duration_seconds' => 180,
                'difficulty_level' => 'beginner',
            ],
        ];

        foreach ($globalTutorials as $item) {
            // Find or create Exercise
            $exercise = Exercise::withoutGlobalScopes()->where('name', $item['exercise_name'])->first();

            if (!$exercise) {
                $exercise = Exercise::create([
                    'name' => $item['exercise_name'],
                    'code' => $item['code'],
                    'category' => $item['muscle_group'],
                    'target_muscle_group' => ucfirst($item['muscle_group']),
                    'exercise_type' => $item['exercise_type'],
                    'equipment_required' => $item['equipment'],
                    'difficulty_level' => $item['difficulty_level'],
                    'instructions' => "Perform {$item['exercise_name']} with controlled form and full range of motion.",
                    'is_system' => true,
                    'is_active' => true,
                ]);
            } else {
                $exercise->update([
                    'code' => $exercise->code ?: $item['code'],
                    'exercise_type' => $exercise->exercise_type ?: $item['exercise_type'],
                    'is_system' => true,
                    'is_active' => true,
                ]);
            }

            // Associate with categories
            $categoryIdsToSync = [];
            if (isset($categoryMap[$item['muscle_group']])) {
                $categoryIdsToSync[] = $categoryMap[$item['muscle_group']];
            }
            if (isset($categoryMap[$item['exercise_type']])) {
                $categoryIdsToSync[] = $categoryMap[$item['exercise_type']];
            }
            if (isset($categoryMap[$item['equipment']])) {
                $categoryIdsToSync[] = $categoryMap[$item['equipment']];
            }
            $exercise->categories()->syncWithoutDetaching($categoryIdsToSync);

            // Create or update global tutorial video
            $privacyEmbedUrl = "https://www.youtube-nocookie.com/embed/{$item['youtube_id']}?rel=0&modestbranding=1&enablejsapi=1";
            $videoUrl = "https://www.youtube.com/watch?v={$item['youtube_id']}";
            $thumbnailUrl = "https://img.youtube.com/vi/{$item['youtube_id']}/hqdefault.jpg";

            $video = ExerciseVideo::updateOrCreate(
                [
                    'exercise_id' => $exercise->id,
                    'gym_id' => null,
                ],
                [
                    'provider' => 'youtube',
                    'video_id' => $item['youtube_id'],
                    'video_url' => $videoUrl,
                    'embed_url' => $privacyEmbedUrl,
                    'thumbnail_url' => $thumbnailUrl,
                    'title' => $item['title'],
                    'creator_name' => $item['creator'],
                    'attribution_text' => "Creator: {$item['creator']} (Channel: {$item['channel']})",
                    'rights_status' => 'public_embed_allowed',
                    'content_source' => 'youtube',
                    'duration_seconds' => $item['duration_seconds'],
                    'status' => 'approved',
                    'health_status' => 'healthy',
                    'is_primary' => true,
                    'is_active' => true,
                    'description' => 'Curated platform-wide exercise demonstration video.',
                ]
            );

            // Set default_video_id on exercise
            $exercise->update([
                'default_video_id' => $video->id,
                'thumbnail_url' => $thumbnailUrl,
            ]);
        }
    }
}
