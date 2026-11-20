<?php

namespace App\Models;

use App\Models\Gym;
use App\Support\CurrentGym;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Food extends Model
{
    use HasFactory;

    protected $table = 'foods';

    protected $fillable = [
        'gym_id',
        'name',
        'name_mr',
        'name_hi',
        'serving_size',
        'serving_unit',
        'calories',
        'protein_g',
        'carbs_g',
        'fat_g',
        'fiber_g',
        'category',
        'dietary_tags',
        'is_system',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'serving_size' => 'decimal:2',
            'calories' => 'decimal:2',
            'protein_g' => 'decimal:2',
            'carbs_g' => 'decimal:2',
            'fat_g' => 'decimal:2',
            'fiber_g' => 'decimal:2',
            'dietary_tags' => 'array',
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
}
