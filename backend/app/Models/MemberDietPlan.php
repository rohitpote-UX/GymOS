<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MemberDietPlan extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'member_id',
        'trainer_id',
        'title',
        'goal',
        'dietary_preference',
        'food_allergies',
        'food_preferences',
        'target_calories',
        'target_protein_g',
        'target_carbs_g',
        'target_fat_g',
        'water_target_ml',
        'meals',
        'version',
        'parent_plan_id',
        'status',
        'start_date',
        'end_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'target_calories' => 'integer',
            'target_protein_g' => 'integer',
            'target_carbs_g' => 'integer',
            'target_fat_g' => 'integer',
            'water_target_ml' => 'integer',
            'meals' => 'array',
            'version' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    protected static function booted()
    {
        static::creating(function ($plan) {
            if (empty($plan->start_date)) {
                $plan->start_date = now()->toDateString();
            }
            if (empty($plan->version)) {
                $plan->version = 1;
            }
        });
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'trainer_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function parentPlan(): BelongsTo
    {
        return $this->belongsTo(MemberDietPlan::class, 'parent_plan_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(MemberDietPlan::class, 'parent_plan_id');
    }

    public function mealLogs(): HasMany
    {
        return $this->hasMany(MemberMealLog::class, 'diet_plan_id');
    }
}
