<?php

namespace App\Models\Concerns;

use App\Models\Branch;
use App\Support\CurrentBranch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trait BelongsToBranch
 *
 * Scopes branch-specific queries when an active branch context is set.
 */
trait BelongsToBranch
{
    public static function bootBelongsToBranch(): void
    {
        static::addGlobalScope('branch', function (Builder $query) {
            $branchId = CurrentBranch::id();
            if ($branchId) {
                $query->where($query->qualifyColumn('branch_id'), $branchId);
            }
        });

        static::creating(function ($model) {
            if (!$model->branch_id && CurrentBranch::id()) {
                $model->branch_id = CurrentBranch::id();
            }
        });
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
