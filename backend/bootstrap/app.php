<?php

use App\Http\Middleware\EnsureGymAccess;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\ResolveGymBranch;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');
        $middleware->append(\App\Http\Middleware\SetLocale::class);

        $middleware->alias([
            'gym' => EnsureGymAccess::class,
            'super.admin' => EnsureSuperAdmin::class,
            'branch' => ResolveGymBranch::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (Throwable $e, Request $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                $errors = $e->errors();
                return response()->json([
                    'message' => collect($errors)->flatten()->first() ?: 'The given data was invalid.',
                    'errors' => $errors,
                ], 422);
            }

            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'message' => 'Please log in to continue.',
                    'code' => 'unauthenticated'
                ], 401);
            }

            if ($e instanceof AuthorizationException) {
                return response()->json([
                    'message' => $e->getMessage() ?: 'You are not authorized to perform this action.',
                    'code' => 'forbidden'
                ], 403);
            }

            if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
                return response()->json([
                    'message' => 'The requested resource was not found.',
                    'code' => 'not_found'
                ], 404);
            }

            if ($e instanceof ThrottleRequestsException) {
                return response()->json([
                    'message' => 'Too many requests. Please slow down and try again in a minute.',
                    'code' => 'too_many_requests'
                ], 429);
            }

            if ($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500) {
                return response()->json([
                    'message' => $e->getMessage() ?: 'An error occurred processing your request.',
                ], $e->getStatusCode());
            }

            return response()->json([
                'message' => 'An internal server error occurred. Please try again.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        });
    })->create();
