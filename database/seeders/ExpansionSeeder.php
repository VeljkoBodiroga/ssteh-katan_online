<?php

namespace Database\Seeders;

use App\Models\Expansion;
use Illuminate\Database\Seeder;

class ExpansionSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            ['title' => 'SEAFARERS', 'image' => 'ekspanzija1.png', 'description' => 'Dodaje more, brodove i nova ostrva za istraživanje i kolonizaciju.'],
            ['title' => 'TRADERS & BARBARIANS', 'image' => 'ekspanzija2.png', 'description' => 'Donosi nove scenarije, trgovce i nove mehanike kretanja karavana.'],
            ['title' => 'EXPLORERS & PIRATES', 'image' => 'ekspanzija3.png', 'description' => 'Dodaje misije, gusare i otkrivanje novih oblasti mape.'],
            ['title' => 'CITIES & KNIGHTS', 'image' => 'ekspanzija4.png', 'description' => 'Uvodi vitezove, unapređenja gradova i odbranu od varvara.'],
        ];

        foreach ($data as $row) {
            Expansion::updateOrCreate(['title' => $row['title']], $row);
        }
    }
}
