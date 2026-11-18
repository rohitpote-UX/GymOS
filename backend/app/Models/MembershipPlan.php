<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MembershipPlan extends Model
{
    use HasFactory, SoftDeletes, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'name',
        'code',
        'category',
        'duration_days',
        'pt_sessions_count',
        'max_freeze_days',
        'plan_type',
        'price',
        'admission_fee',
        'tax_percent',
        'description',
        'features',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'duration_days' => 'integer',
            'pt_sessions_count' => 'integer',
            'max_freeze_days' => 'integer',
            'price' => 'decimal:2',
            'admission_fee' => 'decimal:2',
            'tax_percent' => 'decimal:2',
            'features' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function memberMemberships(): HasMany
    {
        return $this->hasMany(MemberMembership::class);
    }
}
