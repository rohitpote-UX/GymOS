<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Gym;
use App\Models\GymAsset;
use Illuminate\Http\Response;

class BrandingController extends Controller
{
    /**
     * Platform Default Branding.
     */
    public function platform()
    {
        return response()->json([
            'name' => 'Gym Business OS',
            'short_name' => 'GymOS',
            'tagline' => "India's Best Gym Management SaaS",
            'theme_color' => '#0f172a',
            'background_color' => '#090d16',
        ]);
    }

    /**
     * Platform PWA Manifest.
     */
    public function platformManifest()
    {
        $manifest = [
            'name' => 'Gym Business OS',
            'short_name' => 'GymOS',
            'start_url' => '/',
            'display' => 'standalone',
            'theme_color' => '#0f172a',
            'background_color' => '#090d16',
            'icons' => [
                [
                    'src' => '/icon-192.png',
                    'sizes' => '192x192',
                    'type' => 'image/png',
                ],
                [
                    'src' => '/icon-512.png',
                    'sizes' => '512x512',
                    'type' => 'image/png',
                ],
            ],
        ];

        return response()->json($manifest)->header('Content-Type', 'application/manifest+json');
    }

    /**
     * Gym Tenant Specific Branding.
     */
    public function gym(string $slug)
    {
        $gym = Gym::where('slug', $slug)->firstOrFail();
        $branding = $gym->branding ?: [];

        return response()->json([
            'name' => $gym->name,
            'short_name' => $branding['short_name'] ?? substr($gym->name, 0, 15),
            'tagline' => $branding['tagline'] ?? 'Transform Your Strength',
            'primary_color' => $branding['primary_color'] ?? '#0f172a',
            'accent_color' => $branding['accent_color'] ?? '#10b981',
            'assets_version' => $gym->assets_version,
            'logo_url' => "/api/gyms/{$gym->slug}/icons/logo.png?v={$gym->assets_version}",
        ]);
    }

    /**
     * Gym Tenant Dynamic PWA Manifest.
     */
    public function gymManifest(string $slug)
    {
        $gym = Gym::where('slug', $slug)->firstOrFail();
        $branding = $gym->branding ?: [];

        $name = $gym->name;
        $shortName = $branding['short_name'] ?? substr($gym->name, 0, 15);
        $primaryColor = $branding['primary_color'] ?? '#0f172a';

        $manifest = [
            'name' => $name,
            'short_name' => $shortName,
            'start_url' => '/',
            'display' => 'standalone',
            'theme_color' => $primaryColor,
            'background_color' => '#090d16',
            'icons' => [
                [
                    'src' => "/api/gyms/{$slug}/icons/logo.png?v={$gym->assets_version}",
                    'sizes' => '192x192',
                    'type' => 'image/png',
                ],
                [
                    'src' => "/api/gyms/{$slug}/icons/logo.png?v={$gym->assets_version}",
                    'sizes' => '512x512',
                    'type' => 'image/png',
                ],
            ],
        ];

        return response()->json($manifest)->header('Content-Type', 'application/manifest+json');
    }

    /**
     * Serve Stored Gym Asset Image (from base64 in gym_assets table).
     */
    public function icon(string $slug, string $kind)
    {
        $gym = Gym::where('slug', $slug)->firstOrFail();
        $asset = GymAsset::where('gym_id', $gym->id)->where('kind', $kind)->first();

        if (!$asset) {
            return response()->noContent(404);
        }

        $binary = base64_decode($asset->data);

        return response($binary)
            ->header('Content-Type', $asset->mime)
            ->header('Cache-Control', 'public, max-age=604800'); // 7-day browser cache
    }
}
