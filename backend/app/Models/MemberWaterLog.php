<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberWaterLog extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id',
        'member_id',
        'log_date',
        'target_ml',
        'consumed_ml',
    ];

    public function setLogDateAttribute($value)
    {
        $this->attributes['log_date'] = $value instanceof \DateTimeInterface
            ? $value->format('Y-m-d')
            : substr((string) $value, 0, 10);
    }

    protected function casts(): array
    {
        return [
            'log_date' => 'string',
            'target_ml' => 'integer',
            'consumed_ml' => 'integer',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }
}
