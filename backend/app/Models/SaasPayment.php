<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaasPayment extends Model
{
    use BelongsToGym;

    protected $fillable = [
        'gym_id',
        'saas_order_id',
        'saas_plan_id',
        'razorpay_payment_id',
        'razorpay_order_id',
        'amount',
        'currency',
        'payment_method',
        'period_start',
        'period_end',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id');
    }
}
