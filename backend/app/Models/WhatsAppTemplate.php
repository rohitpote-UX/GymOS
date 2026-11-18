<?php

namespace App\Models;

use App\Models\Concerns\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WhatsAppTemplate extends Model
{
    use HasFactory, BelongsToGym;

    protected $table = 'whatsapp_templates';

    protected $fillable = [
        'gym_id',
        'template_name',
        'category', // welcome, payment_receipt, renewal_reminder, attendance, trial_booking, lead_followup, payment_due
        'language',
        'body_text',
        'variables',
        'is_approved',
        'provider_template_id',
        'status', // approved, pending, rejected
    ];

    protected function casts(): array
    {
        return [
            'variables' => 'array',
            'is_approved' => 'boolean',
        ];
    }

    public function logs(): HasMany
    {
        return $this->hasMany(WhatsAppLog::class, 'template_id');
    }
}
