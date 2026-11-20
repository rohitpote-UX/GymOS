<?php

namespace App\Models;

use App\Models\Gym;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DietTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'gym_id',
        'created_by_user_id',
        'title',
        'goal',
        'dietary_preference',
        'target_calories',
        'target_protein_g',
        'target_carbs_g',
        'target_fat_g',
        'meals',
        'is_system',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'target_calories' => 'integer',
            'target_protein_g' => 'integer',
            'target_carbs_g' => 'integer',
            'target_fat_g' => 'integer',
            'meals' => 'array',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('gym_or_system', function (Builder $query) {
            $gymId = CurrentGym::id();
            if ($gymId) {
                $query->where(function ($q) use ($gymId, $query) {
                    $q->whereNull($query->qualifyColumn('gym_id'))
                      ->orWhere($query->qualifyColumn('gym_id'), $gymId);
                });
            } else {
                $query->whereNull($query->qualifyColumn('gym_id'));
            }
        });

        static::creating(function ($model) {
            if (!$model->is_system && empty($model->gym_id)) {
                $model->gym_id = CurrentGym::require();
            }
        });
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
