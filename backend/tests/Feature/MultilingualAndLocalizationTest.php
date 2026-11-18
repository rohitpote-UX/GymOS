<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Gym;
use App\Models\SaasPlan;
use App\Models\User;
use App\Models\WhatsAppTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultilingualAndLocalizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        SaasPlan::create([
            'name' => 'Pro Enterprise',
            'code' => 'pro',
            'price' => 4999,
            'billing_cycle' => 'monthly',
            'max_branches' => 5,
            'max_members' => 1000,
            'features' => ['all'],
            'is_active' => true,
        ]);
    }

    private function createGymWithOwner(string $lang = 'en'): array
    {
        $gym = Gym::create([
            'name' => 'Olympia Fitness Pune',
            'slug' => 'olympia-fitness-pune',
            'currency' => 'INR',
            'status' => 'active',
        ]);

        $branch = Branch::create([
            'gym_id' => $gym->id,
            'name' => 'Kothrud Branch',
            'code' => 'KTH',
            'city' => 'Pune',
            'is_primary' => true,
            'is_active' => true,
        ]);

        $owner = User::create([
            'gym_id' => $gym->id,
            'primary_branch_id' => $branch->id,
            'name' => 'Sameer Deshmukh',
            'email' => 'owner@olympia.fit',
            'phone' => '9820098200',
            'password' => 'password123',
            'role' => 'gym_owner',
            'language' => $lang,
            'is_active' => true,
        ]);

        return [$gym, $branch, $owner];
    }

    public function test_user_language_preference_updates_and_persists(): void
    {
        [$gym, $branch, $owner] = $this->createGymWithOwner('en');

        // 1. Initially English
        $this->assertEquals('en', $owner->language);

        // 2. Update to Marathi
        $response = $this->actingAs($owner)->putJson('/api/me/language', [
            'language' => 'mr',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'language' => 'mr',
                'user' => [
                    'language' => 'mr',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'language' => 'mr',
        ]);

        // 3. Update to Hindi
        $response2 = $this->actingAs($owner)->putJson('/api/me/language', [
            'language' => 'hi',
        ]);

        $response2->assertStatus(200)
            ->assertJson([
                'language' => 'hi',
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'language' => 'hi',
        ]);

        // 4. Invalid language rejected with 422
        $responseInvalid = $this->actingAs($owner)->putJson('/api/me/language', [
            'language' => 'de',
        ]);

        $responseInvalid->assertStatus(422);
    }

    public function test_set_locale_middleware_respects_user_and_headers(): void
    {
        [$gym, $branch, $owner] = $this->createGymWithOwner('mr');

        // Authenticated user with 'mr'
        $response = $this->actingAs($owner)->getJson('/api/me');
        $response->assertStatus(200);
        $this->assertEquals('mr', $response->headers->get('Content-Language'));

        // Unauthenticated request with X-Locale: hi
        $this->app['auth']->forgetGuards();
        $response2 = $this->withHeaders(['X-Locale' => 'hi'])->postJson('/api/login', [
            'login' => 'nonexistent@gym.fit',
            'password' => 'wrongpass',
        ]);

        $response2->assertStatus(422);
        $this->assertEquals('hi', $response2->headers->get('Content-Language'));

        // Accept-Language header matching Marathi
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();
        $response3 = $this->withHeaders(['Accept-Language' => 'mr-IN,mr;q=0.9,en;q=0.8'])
            ->postJson('/api/login', [
                'login' => 'nonexistent@gym.fit',
                'password' => 'wrongpass',
            ]);

        $this->assertEquals('mr', $response3->headers->get('Content-Language'));
    }

    public function test_localized_validation_and_api_responses(): void
    {
        // 1. Marathi localized error message on invalid credentials
        $responseMr = $this->withHeaders(['X-Locale' => 'mr'])->postJson('/api/login', [
            'login' => 'wrong@gym.fit',
            'password' => 'invalid',
        ]);

        $responseMr->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'दिलेला ईमेल किंवा पासवर्ड जुळत नाही.');

        // 2. Hindi localized error message on invalid credentials
        $responseHi = $this->withHeaders(['X-Locale' => 'hi'])->postJson('/api/login', [
            'login' => 'wrong@gym.fit',
            'password' => 'invalid',
        ]);

        $responseHi->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'दर्ज किया गया विवरण हमारे रिकॉर्ड से मेल नहीं खाता।');

        // 3. English default error message
        $responseEn = $this->withHeaders(['X-Locale' => 'en'])->postJson('/api/login', [
            'login' => 'wrong@gym.fit',
            'password' => 'invalid',
        ]);

        $responseEn->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'The provided credentials do not match our records.');
    }

    public function test_multilingual_whatsapp_templates(): void
    {
        [$gym, $branch, $owner] = $this->createGymWithOwner('en');

        // Fetch templates - should seed en, mr, and hi
        $response = $this->actingAs($owner)
            ->withHeaders(['X-Branch-ID' => $branch->id])
            ->getJson('/api/whatsapp/templates');

        $response->assertStatus(200);

        // Check database has templates for en, mr, and hi
        $this->assertDatabaseHas('whatsapp_templates', [
            'gym_id' => $gym->id,
            'category' => 'welcome',
            'language' => 'en',
        ]);

        $this->assertDatabaseHas('whatsapp_templates', [
            'gym_id' => $gym->id,
            'category' => 'welcome',
            'language' => 'mr',
        ]);

        $this->assertDatabaseHas('whatsapp_templates', [
            'gym_id' => $gym->id,
            'category' => 'welcome',
            'language' => 'hi',
        ]);

        // Send a Marathi WhatsApp message
        $sendMr = $this->actingAs($owner)
            ->withHeaders(['X-Branch-ID' => $branch->id])
            ->postJson('/api/whatsapp/send', [
                'category' => 'welcome',
                'language' => 'mr',
                'recipient_phone' => '9820011223',
                'recipient_name' => 'सचिन तेंडुलकर',
                'variables' => [
                    'member_name' => 'सचिन तेंडुलकर',
                    'plan_name' => 'वार्षिक गोल्ड प्लॅन',
                    'expiry_date' => '१८ नोव्हेंबर २०२७',
                    'member_code' => 'MEM-0001',
                ],
            ]);

        $sendMr->assertStatus(201);
        $logMr = $sendMr->json('log');
        $this->assertStringContainsString('मध्ये आपले सहर्ष स्वागत', $logMr['message_body']);
        $this->assertStringContainsString('सचिन तेंडुलकर', $logMr['message_body']);

        // Send a Hindi WhatsApp message
        $sendHi = $this->actingAs($owner)
            ->withHeaders(['X-Branch-ID' => $branch->id])
            ->postJson('/api/whatsapp/send', [
                'category' => 'welcome',
                'language' => 'hi',
                'recipient_phone' => '9820011224',
                'recipient_name' => 'रोहित शर्मा',
                'variables' => [
                    'member_name' => 'रोहित शर्मा',
                    'plan_name' => 'वार्षिक प्रीमियम',
                    'expiry_date' => '१८ नवंबर २०२७',
                    'member_code' => 'MEM-0002',
                ],
            ]);

        $sendHi->assertStatus(201);
        $logHi = $sendHi->json('log');
        $this->assertStringContainsString('में आपका सहर्ष स्वागत है', $logHi['message_body']);
        $this->assertStringContainsString('रोहित शर्मा', $logHi['message_body']);
    }

    public function test_csv_export_multilingual_headers(): void
    {
        [$gym, $branch, $owner] = $this->createGymWithOwner('en');

        // 1. Marathi CSV export
        ob_start();
        $responseMr = $this->actingAs($owner)
            ->withHeaders(['X-Branch-ID' => $branch->id])
            ->get('/api/reports/export/members?lang=mr');
        $responseMr->sendContent();
        $contentMr = ob_get_clean();

        $this->assertStringContainsString('सदस्य कोड', $contentMr);
        $this->assertStringContainsString('पहिले नाव', $contentMr);
        $this->assertStringContainsString('शिल्लक थकबाकी', $contentMr);

        // 2. Hindi CSV export
        ob_start();
        $responseHi = $this->actingAs($owner)
            ->withHeaders(['X-Branch-ID' => $branch->id])
            ->get('/api/reports/export/members?lang=hi');
        $responseHi->sendContent();
        $contentHi = ob_get_clean();

        $this->assertStringContainsString('सदस्य कोड', $contentHi);
        $this->assertStringContainsString('प्रथम नाम', $contentHi);
        $this->assertStringContainsString('बकाया राशि', $contentHi);

        // 3. English CSV export
        ob_start();
        $responseEn = $this->actingAs($owner)
            ->withHeaders(['X-Branch-ID' => $branch->id])
            ->get('/api/reports/export/members?lang=en');
        $responseEn->sendContent();
        $contentEn = ob_get_clean();

        $this->assertStringContainsString('Member Code', $contentEn);
        $this->assertStringContainsString('First Name', $contentEn);
        $this->assertStringContainsString('Outstanding Balance', $contentEn);
    }

    public function test_independent_staff_language_preferences(): void
    {
        [$gym, $branch, $owner] = $this->createGymWithOwner('en');

        // Front Desk with Marathi
        $receptionist = User::create([
            'gym_id' => $gym->id,
            'primary_branch_id' => $branch->id,
            'name' => 'Pooja Kadam',
            'email' => 'reception@olympia.fit',
            'phone' => '9820098201',
            'password' => 'password123',
            'role' => 'front_desk',
            'language' => 'mr',
            'is_active' => true,
        ]);

        // Trainer with Hindi
        $trainer = User::create([
            'gym_id' => $gym->id,
            'primary_branch_id' => $branch->id,
            'name' => 'Rahul Verma',
            'email' => 'trainer@olympia.fit',
            'phone' => '9820098202',
            'password' => 'password123',
            'role' => 'trainer',
            'language' => 'hi',
            'is_active' => true,
        ]);

        // Verify independent locales via API
        $ownerRes = $this->actingAs($owner)->getJson('/api/me');
        $this->assertEquals('en', $ownerRes->json('user.language'));
        $this->assertEquals('en', $ownerRes->headers->get('Content-Language'));

        $receptionRes = $this->actingAs($receptionist)->getJson('/api/me');
        $this->assertEquals('mr', $receptionRes->json('user.language'));
        $this->assertEquals('mr', $receptionRes->headers->get('Content-Language'));

        $trainerRes = $this->actingAs($trainer)->getJson('/api/me');
        $this->assertEquals('hi', $trainerRes->json('user.language'));
        $this->assertEquals('hi', $trainerRes->headers->get('Content-Language'));
    }
}
