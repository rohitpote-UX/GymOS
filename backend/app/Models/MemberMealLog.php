<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberMealLog extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'member_id',
        'diet_plan_id',
        'log_date',
        'meal_slot',
        'is_completed',
        'consumed_items',
        'completed_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'log_date' => 'date',
            'is_completed' => 'boolean',
            'consumed_items' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function dietPlan(): BelongsTo
    {
        return $this->belongsTo(MemberDietPlan::class, 'diet_plan_id');
    }
}
