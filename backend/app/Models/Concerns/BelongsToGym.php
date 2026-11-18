<?php

namespace App\Models\Concerns;

use App\Models\Gym;
use App\Support\CurrentGym;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trait BelongsToGym
 *
 * Ensures all Eloquent queries automatically filter by the authenticated gym tenant.
 * Fail-closed: If no gym context exists, queries match 0 rows (whereRaw('1 = 0')).
 * On creation, auto-populates gym_id with CurrentGym::require().
 */
trait BelongsToGym
{
    public static function bootBelongsToGym(): void
    {
        static::addGlobalScope('gym', function (Builder $query) {
            $gymId = CurrentGym::id();
            if ($gymId) {
                $query->where($query->qualifyColumn('gym_id'), $gymId);
            } else {
                $query->whereRaw('1 = 0');
            }
        });

        static::creating(function ($model) {
            $model->gym_id ??= CurrentGym::require();
        });
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }
}
