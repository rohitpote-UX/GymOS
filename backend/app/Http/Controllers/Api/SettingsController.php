<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\GymAsset;
use App\Support\CurrentGym;
use App\Support\ModuleRegistry;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function show()
    {
        $gym = CurrentGym::get();
        $assets = GymAsset::where('gym_id', $gym->id)->pluck('kind')->toArray();

        return response()->json([
            'gym' => $gym,
            'settings' => $gym->settings ?: [],
            'branding' => $gym->branding ?: [],
            'has_logo' => in_array('logo', $assets, true),
        ]);
    }

    public function update(Request $request)
    {
        $gym = CurrentGym::get();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'legal_name' => ['nullable', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'currency' => ['nullable', 'string', 'max:10'],
            'settings' => ['nullable', 'array'],
            'branding' => ['nullable', 'array'],
        ]);

        if (isset($validated['name'])) {
            $gym->name = $validated['name'];
        }
        if (isset($validated['legal_name'])) {
            $gym->legal_name = $validated['legal_name'];
        }
        if (isset($validated['email'])) {
            $gym->email = $validated['email'];
        }
        if (isset($validated['phone'])) {
            $gym->phone = $validated['phone'];
        }
        if (isset($validated['currency'])) {
            $gym->currency = $validated['currency'];
        }

        if (isset($validated['settings'])) {
            $gym->settings = array_merge($gym->settings ?: [], $validated['settings']);
        }

        if (isset($validated['branding'])) {
            $gym->branding = array_merge($gym->branding ?: [], $validated['branding']);
        }

        $gym->save();

        AuditLog::record('settings.updated', ['changes' => array_keys($validated)]);

        return response()->json([
            'message' => 'Settings updated successfully.',
            'gym' => $gym->fresh(),
        ]);
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'image' => ['required', 'string'], // Base64 data URI
        ]);

        $gym = CurrentGym::get();
        $dataUri = $request->input('image');

        if (preg_match('/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/', $dataUri, $matches)) {
            $mime = $matches[1];
            $base64Data = $matches[2];

            GymAsset::updateOrCreate(
                ['gym_id' => $gym->id, 'kind' => 'logo'],
                ['mime' => $mime, 'data' => $base64Data]
            );

            $gym->increment('assets_version');

            AuditLog::record('branding.logo_uploaded');

            return response()->json(['message' => 'Logo uploaded successfully.', 'assets_version' => $gym->assets_version]);
        }

        return response()->json(['message' => 'Invalid image format. Expected base64 data URI.'], 422);
    }

    public function removeLogo()
    {
        $gym = CurrentGym::get();
        GymAsset::where('gym_id', $gym->id)->where('kind', 'logo')->delete();
        $gym->increment('assets_version');

        AuditLog::record('branding.logo_removed');

        return response()->json(['message' => 'Logo removed successfully.']);
    }

    public function modules()
    {
        $gym = CurrentGym::get();
        $allModules = ModuleRegistry::all();
        $entitled = $gym->getPlanEntitledModules();
        $active = $gym->getActiveModules();

        return response()->json([
            'all_modules' => $allModules,
            'entitled_modules' => $entitled,
            'active_modules' => $active,
            'plan' => $gym->plan ? [
                'id' => $gym->plan->id,
                'name' => $gym->plan->name,
                'code' => $gym->plan->code,
            ] : null,
        ]);
    }

    public function updateModules(Request $request)
    {
        $gym = CurrentGym::get();

        $validated = $request->validate([
            'modules' => ['required', 'array'],
            'modules.*' => ['string'],
        ]);

        $entitled = $gym->getPlanEntitledModules();
        $requested = $validated['modules'];

        // Core modules are always active
        $core = [ModuleRegistry::MODULE_OVERVIEW, ModuleRegistry::MODULE_MEMBERS];

        // Ensure user cannot activate modules not entitled by plan
        $invalid = array_diff($requested, $entitled);
        if (!empty($invalid)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Your subscription plan does not permit activating the following module(s): ' . implode(', ', $invalid) . '. Please upgrade your plan.',
                'invalid_modules' => array_values($invalid),
            ], 422);
        }

        // Validate dependencies
        $allDefs = ModuleRegistry::all();
        foreach ($requested as $modKey) {
            if (isset($allDefs[$modKey]['dependencies'])) {
                foreach ($allDefs[$modKey]['dependencies'] as $dep) {
                    if (!in_array($dep, $requested, true)) {
                        return response()->json([
                            'status' => 'error',
                            'message' => "Module '{$allDefs[$modKey]['name']}' requires module '{$allDefs[$dep]['name']}' to be active.",
                        ], 422);
                    }
                }
            }
        }

        $finalModules = array_values(array_unique(array_merge($core, $requested)));
        $gym->modules = $finalModules;
        $gym->save();
        CurrentGym::clear();

        AuditLog::record('settings.modules_updated', ['modules' => $finalModules]);

        return response()->json([
            'message' => 'Gym feature modules updated successfully.',
            'active_modules' => $gym->getActiveModules(),
            'entitled_modules' => $gym->getPlanEntitledModules(),
        ]);
    }
}
