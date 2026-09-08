<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlayerStat extends Model
{
    protected $fillable = ['user_id', 'odigrane', 'pobedjene', 'ukupno_poena'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Isto sto i PlayerStats klasa iz React Modeli/Statistika.ts
    public function getProcenatAttribute(): int
    {
        return $this->odigrane > 0
            ? (int) round(($this->pobedjene / $this->odigrane) * 100)
            : 0;
    }

    public function getPoeniPoPartijiAttribute(): float
    {
        return $this->odigrane > 0
            ? round($this->ukupno_poena / $this->odigrane, 2)
            : 0;
    }
}
