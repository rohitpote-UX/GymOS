<?php

namespace App\Models;

use App\Support\ModuleRegistry;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SaasPlan extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'price',
        'interval',
        'branch_limit',
        'member_limit',
        'features',
        'modules',
        'is_active',
        'sort_order',
        'razorpay_plan_id',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'branch_limit' => 'integer',
            'member_limit' => 'integer',
            'features' => 'array',
            'modules' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function getEffectiveModules(): array
    {
        return !empty($this->modules) ? $this->modules : ModuleRegistry::defaultPlanModules($this->code);
    }

    public function gyms(): HasMany
    {
        return $this->hasMany(Gym::class);
    }
}
