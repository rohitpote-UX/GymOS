<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use HasFactory, SoftDeletes, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'name',
        'code',
        'phone',
        'email',
        'address',
        'city',
        'state',
        'pincode',
        'capacity',
        'is_active',
        'is_primary',
        'operating_hours',
        'visitor_pass_enabled',
        'one_day_pass_price',
        'one_day_pass_gst_rate',
        'visitor_access_hours',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_primary' => 'boolean',
            'capacity' => 'integer',
            'operating_hours' => 'array',
            'visitor_pass_enabled' => 'boolean',
            'one_day_pass_price' => 'decimal:2',
            'one_day_pass_gst_rate' => 'decimal:2',
        ];
    }

    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'branch_user')->withTimestamps();
    }

    public function members(): HasMany
    {
        return $this->hasMany(Member::class, 'primary_branch_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(AttendanceLog::class);
    }

    public function visitorPasses(): HasMany
    {
        return $this->hasMany(VisitorPass::class);
    }

    public function qrCodes(): HasMany
    {
        return $this->hasMany(GymQrCode::class);
    }

    public function getEffectiveOneDayPassPrice(): float
    {
        if ($this->one_day_pass_price !== null && (float) $this->one_day_pass_price > 0) {
            return (float) $this->one_day_pass_price;
        }

        // Fallback to gym global settings or default 150.00
        $gymSettings = $this->gym?->settings ?? [];
        return (float) ($gymSettings['one_day_pass_price'] ?? 150.00);
    }
}
