<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaasOrder extends Model
{
    use BelongsToGym;

    protected $fillable = [
        'gym_id',
        'saas_plan_id',
        'razorpay_order_id',
        'amount',
        'currency',
        'interval',
        'status',
        'receipt',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'meta' => 'array',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id');
    }
}
