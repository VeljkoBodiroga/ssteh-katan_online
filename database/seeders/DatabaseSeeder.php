<?php

namespace Database\Seeders;

use App\Models\PlayerStat;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@catan.com'],
            ['username' => 'admin', 'password' => Hash::make('admin1234'), 'role' => 'admin']
        );
        PlayerStat::updateOrCreate(['user_id' => $admin->id], ['odigrane' => 12, 'pobedjene' => 7, 'ukupno_poena' => 85]);

        $demo = User::updateOrCreate(
            ['email' => 'igrac@catan.com'],
            ['username' => 'igrac1', 'password' => Hash::make('lozinka123'), 'role' => 'user']
        );
        PlayerStat::updateOrCreate(['user_id' => $demo->id], ['odigrane' => 5, 'pobedjene' => 2, 'ukupno_poena' => 30]);

        $this->call(ExpansionSeeder::class);
    }
}
