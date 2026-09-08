<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tip migracije: KREIRANJE PIVOT TABELE SA VISE STRANIH KLJUCEVA (many-to-many + FK)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained('games')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->json('resources')->nullable(); // drvo, ovca, psenica, cigla, kamen
            $table->json('fields')->nullable();     // koja polja igrac poseduje
            $table->unsignedInteger('points')->default(0);
            $table->timestamps();

            $table->unique(['game_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_players');
    }
};
