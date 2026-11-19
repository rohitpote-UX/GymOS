<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Gym extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_TRIAL = 'trial';

    protected $fillable = [
        'name',
        'legal_name',
        'slug',
        'email',
        'phone',
        'currency',
        'status',
        'trial_ends_at',
        'saas_plan_id',
        'subscription_expires_at',
        'billing_cycle',
        'settings',
        'modules',
        'branding',
        'assets_version',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'subscription_expires_at' => 'datetime',
            'settings' => 'array',
            'modules' => 'array',
            'branding' => 'array',
            'assets_version' => 'integer',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id');
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(Member::class);
    }

    public function membershipPlans(): HasMany
    {
        return $this->hasMany(MembershipPlan::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(GymAsset::class);
    }

    public function isExpired(): bool
    {
        if ($this->status === self::STATUS_TRIAL) {
            return $this->trial_ends_at !== null && $this->trial_ends_at->isPast();
        }

        return $this->subscription_expires_at !== null && $this->subscription_expires_at->isPast();
    }

    public function isUsable(): bool
    {
        return $this->status !== self::STATUS_SUSPENDED && !$this->isExpired() && !$this->trashed();
    }

    public function getPlanEntitledModules(): array
    {
        if ($this->plan) {
            return $this->plan->getEffectiveModules();
        }

        return \App\Support\ModuleRegistry::defaultPlanModules('enterprise');
    }

    public function getActiveModules(): array
    {
        if ($this->modules !== null) {
            return array_values(array_unique(array_merge(
                [\App\Support\ModuleRegistry::MODULE_OVERVIEW, \App\Support\ModuleRegistry::MODULE_MEMBERS],
                $this->modules
            )));
        }

        return $this->getPlanEntitledModules();
    }

    public function hasModule(string $moduleKey): bool
    {
        return in_array($moduleKey, $this->getActiveModules(), true);
    }

    public function canActivateModule(string $moduleKey): bool
    {
        return in_array($moduleKey, $this->getPlanEntitledModules(), true);
    }
}
