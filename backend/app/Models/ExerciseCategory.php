<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ExerciseCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'name_mr',
        'name_hi',
        'slug',
        'type', // muscle_group, exercise_type, equipment
        'icon',
        'description',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function exercises(): BelongsToMany
    {
        return $this->belongsToMany(Exercise::class, 'exercise_category_mappings', 'category_id', 'exercise_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('name');
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('type', $type);
    }
}
