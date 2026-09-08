<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tip migracije: IZMENA TIPA KOLONE (alter table - change column)
// Prosirujemo status sa (setup, in_progress, finished) na i 'lobby' - lakse je
// promeniti enum u string i validirati vrednosti u kodu (App\Models\Game) nego
// menjati MySQL ENUM tip naknadno.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->string('status', 20)->default('lobby')->change();
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->enum('status', ['setup', 'in_progress', 'finished'])->default('setup')->change();
        });
    }
};