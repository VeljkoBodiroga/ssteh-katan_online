<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tip migracije: DODAVANJE INDEKSA (alter table - add index)
// Ubrzava pretragu ekspanzija po nazivu (koristi se u filtriranju/pretrazi).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expansions', function (Blueprint $table) {
            $table->index('title', 'expansions_title_index');
        });
    }

    public function down(): void
    {
        Schema::table('expansions', function (Blueprint $table) {
            $table->dropIndex('expansions_title_index');
        });
    }
};
