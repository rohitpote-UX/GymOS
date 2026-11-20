<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class GymQrCode extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'token',
        'code',
        'name',
        'is_active',
        'require_location',
        'latitude',
        'longitude',
        'radius_meters',
        'require_staff_confirmation',
        'rotating_mode',
        'scan_count',
        'last_scanned_at',
        'created_by_user_id',
        'deactivated_at',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'require_location' => 'boolean',
            'require_staff_confirmation' => 'boolean',
            'rotating_mode' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
            'radius_meters' => 'integer',
            'scan_count' => 'integer',
            'last_scanned_at' => 'datetime',
            'deactivated_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function attendanceLogs(): HasMany
    {
        return $this->hasMany(AttendanceLog::class, 'gym_qr_code_id');
    }

    /**
     * Generate a new unique token and code
     */
    public static function createUnique(int $gymId, int $branchId, ?int $userId = null, array $attributes = []): self
    {
        $branch = Branch::find($branchId);
        $branchPrefix = $branch && $branch->code ? strtoupper($branch->code) : 'BR' . $branchId;
        $code = 'QR-' . $branchPrefix . '-' . strtoupper(Str::random(6));

        // Ensure token is unguessable and secure (64 characters)
        $token = 'gymqr_' . Str::random(56);

        return self::create(array_merge([
            'gym_id' => $gymId,
            'branch_id' => $branchId,
            'token' => $token,
            'code' => $code,
            'name' => ($branch ? $branch->name . ' - ' : '') . 'Self Check-in QR',
            'is_active' => true,
            'require_location' => false,
            'radius_meters' => 150,
            'created_by_user_id' => $userId,
        ], $attributes));
    }

    /**
     * Regenerate QR token & code (invalidates old printed posters while preserving past attendance)
     */
    public function regenerateToken(): self
    {
        $branchPrefix = $this->branch && $this->branch->code ? strtoupper($this->branch->code) : 'BR' . $this->branch_id;

        $this->update([
            'token' => 'gymqr_' . Str::random(56),
            'code' => 'QR-' . $branchPrefix . '-' . strtoupper(Str::random(6)),
            'is_active' => true,
            'deactivated_at' => null,
        ]);

        return $this->fresh();
    }

    /**
     * Calculate Haversine distance in meters from given coordinates
     */
    public function distanceMeters(float $lat, float $lon): ?float
    {
        if ($this->latitude === null || $this->longitude === null) {
            return null;
        }

        $earthRadius = 6371000; // in meters
        $latFrom = deg2rad($this->latitude);
        $lonFrom = deg2rad($this->longitude);
        $latTo = deg2rad($lat);
        $lonTo = deg2rad($lon);

        $latDelta = $latTo - $latFrom;
        $lonDelta = $lonTo - $lonFrom;

        $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
            cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)));

        return round($angle * $earthRadius, 2);
    }
}
