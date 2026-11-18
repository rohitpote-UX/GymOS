<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use BelongsToGym;

    protected $fillable = [
        'gym_id',
        'branch_id',
        'user_id',
        'event',
        'ip_address',
        'user_agent',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Helper to log tenant or system events cleanly.
     */
    public static function record(string $event, ?array $payload = null, ?int $branchId = null): self
    {
        return self::create([
            'event' => $event,
            'branch_id' => $branchId,
            'user_id' => auth()->id(),
            'ip_address' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 255),
            'payload' => $payload,
        ]);
    }
}
