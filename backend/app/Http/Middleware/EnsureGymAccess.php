<?php

namespace App\Http\Middleware;

use App\Models\Gym;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensures that incoming requests belong to an active, valid gym tenant.
 * Expired gyms are locked down except for billing routes so owners can renew.
 */
class EnsureGymAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        $reason = self::blockReason($user);

        // Allow billing routes so an expired gym can purchase or renew subscription
        if ($reason === 'gym_expired' && $request->routeIs('billing.*')) {
            return $next($request);
        }

        if ($reason) {
            return response()->json([
                'message' => self::message($reason),
                'code' => $reason
            ], 403);
        }

        return $next($request);
    }

    public static function blockReason(?User $user): ?string
    {
        if (!$user || !$user->is_active) {
            return 'user_inactive';
        }

        if ($user->isSuperAdmin()) {
            return 'no_gym'; // Super admin manages platform via /admin routes
        }

        $gym = $user->gym;
        if (!$gym) {
            return 'no_gym';
        }

        if ($gym->status === Gym::STATUS_SUSPENDED || $gym->trashed()) {
            return 'gym_suspended';
        }

        if ($gym->isExpired()) {
            return 'gym_expired';
        }

        return null;
    }

    public static function message(string $reason): string
    {
        return match ($reason) {
            'gym_suspended' => 'This gym account has been suspended. Please contact platform support.',
            'gym_expired' => 'Your gym subscription plan has expired. Please renew to continue accessing the system.',
            'no_gym' => 'This user account is not associated with an active gym.',
            default => 'This account has been disabled.',
        };
    }
}
