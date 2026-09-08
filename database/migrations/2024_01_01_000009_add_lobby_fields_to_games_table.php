<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tip migracije: DODAVANJE KOLONA (alter table - add column)
// Omogucava lobi sistem: kreator dobija kratki kod koji deli sa ostalima da se pridruze.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->string('lobby_code', 8)->nullable()->unique()->after('id');
            $table->unsignedTinyInteger('max_players')->default(4)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn(['lobby_code', 'max_players']);
        });
    }
};