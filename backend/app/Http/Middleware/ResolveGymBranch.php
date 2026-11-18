<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\User;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveGymBranch
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        if (!$user || !$user->gym_id) {
            return $next($request);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->query('branch_id');

        if ($branchId) {
            $branchId = (int) $branchId;
            // Validate branch belongs to current gym
            $branch = Branch::where('id', $branchId)->where('gym_id', CurrentGym::id())->first();

            if (!$branch) {
                return response()->json(['message' => 'Specified branch not found for this gym.'], 404);
            }

            // Verify staff member has access to this branch
            if (!$user->isOwner() && !$user->isSuperAdmin()) {
                $hasAccess = $user->primary_branch_id === $branchId ||
                    $user->branches()->where('branches.id', $branchId)->exists();

                if (!$hasAccess) {
                    return response()->json(['message' => 'You do not have access to this branch.'], 403);
                }
            }

            CurrentBranch::set($branchId);
        } else {
            CurrentBranch::set($user->primary_branch_id);
        }

        return $next($request);
    }
}
