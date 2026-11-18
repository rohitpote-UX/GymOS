<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * Supported locales in Gym Business OS.
     */
    public const SUPPORTED_LOCALES = ['en', 'mr', 'hi'];

    /**
     * Handle an incoming request and set application locale.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->determineLocale($request);
        app()->setLocale($locale);

        /** @var Response $response */
        $response = $next($request);

        // If client did NOT explicitly send X-Locale, check if user was authenticated by inner middleware
        if (!$request->hasHeader('X-Locale')) {
            $user = $request->user();
            if ($user && !empty($user->language) && in_array($user->language, self::SUPPORTED_LOCALES, true)) {
                $locale = $user->language;
                app()->setLocale($locale);
            }
        }

        // Append Content-Language header to response
        if (isset($response->headers)) {
            $response->headers->set('Content-Language', $locale);
        }

        return $response;
    }

    /**
     * Determine requested locale from X-Locale header, user profile, or Accept-Language.
     */
    protected function determineLocale(Request $request): string
    {
        // 1. Explicit custom header X-Locale takes precedence
        if ($request->hasHeader('X-Locale')) {
            $headerLocale = strtolower(trim((string) $request->header('X-Locale')));
            if (in_array($headerLocale, self::SUPPORTED_LOCALES, true)) {
                return $headerLocale;
            }
        }

        // 2. Check user preference if authenticated
        $user = $request->user();
        if ($user && !empty($user->language) && in_array($user->language, self::SUPPORTED_LOCALES, true)) {
            return $user->language;
        }

        // 3. Otherwise check Accept-Language (e.g. "mr-IN,mr;q=0.9,hi;q=0.8,en;q=0.7")
        if ($request->hasHeader('Accept-Language')) {
            $accept = strtolower((string) $request->header('Accept-Language'));
            if (str_contains($accept, 'mr')) {
                return 'mr';
            } elseif (str_contains($accept, 'hi')) {
                return 'hi';
            }
        }

        return 'en';
    }
}
