<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expansion extends Model
{
    protected $fillable = ['title', 'image', 'description'];

    /**
     * Isto sto i shortDesc() iz React Modeli/Ekspanzije.ts
     */
    public function shortDesc(int $maxLength = 80): string
    {
        return \Illuminate\Support\Str::limit($this->description, $maxLength);
    }

    /**
     * Seed slike su u public/images/*.png, admin-upload slike su u storage/app/public/expansions/*.
     */
    public function getImageUrlAttribute(): string
    {
        return str_starts_with($this->image, 'expansions/')
            ? asset('storage/'.$this->image)
            : asset('images/'.$this->image);
    }
}
