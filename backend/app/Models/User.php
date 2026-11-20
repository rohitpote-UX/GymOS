<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public const ROLE_SUPER_ADMIN = 'super_admin';
    public const ROLE_GYM_OWNER = 'gym_owner';
    public const ROLE_BRANCH_MANAGER = 'branch_manager';
    public const ROLE_TRAINER = 'trainer';
    public const ROLE_FRONT_DESK = 'front_desk';
    public const ROLE_ACCOUNTANT = 'accountant';
    public const ROLE_INVENTORY_MANAGER = 'inventory_manager';
    public const ROLE_MEMBER = 'member';

    protected $fillable = [
        'gym_id',
        'primary_branch_id',
        'name',
        'email',
        'phone',
        'password',
        'role',
        'language',
        'permissions',
        'is_active',
        'avatar_url',
        'base_salary',
        'commission_percent',
        'pt_session_rate',
        'specialization',
        'bio',
        'emergency_contact_phone',
        'joined_date',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'permissions' => 'array',
            'base_salary' => 'decimal:2',
            'commission_percent' => 'decimal:2',
            'pt_session_rate' => 'decimal:2',
            'joined_date' => 'date',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class)->withTrashed();
    }

    public function primaryBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'primary_branch_id');
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'branch_user')->withTimestamps();
    }

    public function assignedMembers(): HasMany
    {
        return $this->hasMany(Member::class, 'assigned_trainer_id');
    }

    public function ptSessions(): HasMany
    {
        return $this->hasMany(PtSession::class, 'trainer_id');
    }

    public function leaves(): HasMany
    {
        return $this->hasMany(StaffLeave::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    public function isOwner(): bool
    {
        return $this->role === self::ROLE_GYM_OWNER;
    }

    public function isTrainer(): bool
    {
        return $this->role === self::ROLE_TRAINER;
    }

    public function hasRole(string|array $roles): bool
    {
        if (is_array($roles)) {
            return in_array($this->role, $roles, true);
        }

        return $this->role === $roles;
    }

    /**
     * Role default permissions matrix.
     */
    public static function defaultPermissions(string $role): array
    {
        return match ($role) {
            self::ROLE_SUPER_ADMIN => ['*'],
            self::ROLE_GYM_OWNER => [
                'branches.manage', 'branches.view',
                'staff.manage', 'staff.view',
                'members.manage', 'members.view',
                'plans.manage', 'plans.view',
                'payments.record', 'payments.view',
                'attendance.record', 'attendance.view',
                'expenses.manage', 'expenses.view',
                'leads.manage', 'leads.view',
                'trainers.manage', 'trainers.view',
                'workouts.manage', 'diet.manage',
                'cash.manage', 'cash.view',
                'reports.financial', 'reports.attendance',
                'settings.edit', 'branding.edit', 'billing.manage'
            ],
            self::ROLE_BRANCH_MANAGER => [
                'branches.view',
                'staff.view',
                'members.manage', 'members.view',
                'plans.view',
                'payments.record', 'payments.view',
                'attendance.record', 'attendance.view',
                'expenses.manage', 'expenses.view',
                'leads.manage', 'leads.view',
                'trainers.view',
                'workouts.manage', 'diet.manage',
                'cash.manage', 'cash.view',
                'reports.attendance', 'reports.financial'
            ],
            self::ROLE_FRONT_DESK => [
                'branches.view',
                'members.manage', 'members.view',
                'plans.view',
                'payments.record', 'payments.view',
                'attendance.record', 'attendance.view',
                'leads.manage', 'leads.view',
                'cash.manage'
            ],
            self::ROLE_TRAINER => [
                'branches.view',
                'members.view',
                'attendance.record', 'attendance.view',
                'trainers.view', 'workouts.manage', 'diet.manage'
            ],
            self::ROLE_ACCOUNTANT => [
                'branches.view',
                'payments.record', 'payments.view',
                'expenses.manage', 'expenses.view',
                'cash.manage', 'cash.view',
                'suppliers.view', 'suppliers.manage',
                'reports.financial', 'profitability.view'
            ],
            self::ROLE_INVENTORY_MANAGER => [
                'branches.view',
                'inventory.manage', 'inventory.view',
                'products.manage', 'products.view',
                'suppliers.manage', 'suppliers.view',
                'pos.view', 'profitability.view'
            ],
            self::ROLE_MEMBER => [
                'portal.view'
            ],
            default => [],
        };
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin() || $this->isOwner()) {
            return true;
        }

        $custom = $this->permissions;
        if (is_array($custom)) {
            if (in_array('*', $custom, true) || in_array($permission, $custom, true)) {
                return true;
            }
        }

        $defaults = self::defaultPermissions($this->role);
        return in_array('*', $defaults, true) || in_array($permission, $defaults, true);
    }
}
