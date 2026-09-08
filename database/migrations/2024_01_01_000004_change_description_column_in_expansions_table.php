<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tip migracije: IZMENA TIPA KOLONE (alter table - change column)
// Napomena: zahteva "doctrine/dbal" paket (composer require doctrine/dbal) da bi change() radio.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expansions', function (Blueprint $table) {
            $table->text('description')->change();
        });
    }

    public function down(): void
    {
        Schema::table('expansions', function (Blueprint $table) {
            $table->string('description', 500)->change();
        });
    }
};
