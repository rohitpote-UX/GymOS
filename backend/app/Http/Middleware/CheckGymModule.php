<?php

namespace App\Http\Middleware;

use App\Support\CurrentGym;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckGymModule
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $module): Response
    {
        $gym = CurrentGym::get();

        if (!$gym) {
            return $next($request);
        }

        // Core modules are always accessible
        if (in_array($module, ['overview', 'members'], true)) {
            return $next($request);
        }

        if (!$gym->hasModule($module)) {
            $canActivate = $gym->canActivateModule($module);

            return response()->json([
                'status' => 'error',
                'error' => $canActivate ? 'module_deactivated' : 'module_upgrade_required',
                'module' => $module,
                'message' => $canActivate
                    ? "The '{$module}' module is currently deactivated in your Gym Settings."
                    : "The '{$module}' feature is not included in your current SaaS subscription plan. Please upgrade to access this feature.",
            ], 403);
        }

        return $next($request);
    }
}
