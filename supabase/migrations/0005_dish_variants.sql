-- Dish variants where preparation meaningfully changes calories.
-- All existing rows untouched — additions only.

insert into public.food_items (name, calories, protein_g, carbs_g, fat_g, serving_description) values

-- Sliced Fish Soup variants
-- Base (310 kcal) = steamed fish, clear broth.
-- Fried fish adds ~60 kcal; milky/evaporated-milk broth adds ~100 kcal.
('Sliced Fish Soup (fried fish, clear broth)',    370, 27, 30, 17, '1 bowl'),
('Sliced Fish Soup (steamed fish, milky broth)',  410, 28, 33, 16, '1 bowl'),
('Sliced Fish Soup (fried fish, milky broth)',    470, 28, 33, 23, '1 bowl'),

-- Laksa variant
-- Base (589 kcal) = curry laksa with coconut milk.
-- Asam laksa is tamarind-based, no coconut milk — roughly half the fat.
('Laksa (asam)', 320, 18, 52, 6, '1 bowl'),

-- Wonton Mee variants
-- Base (439 kcal) = generic. Dry adds chili/sesame oil dressing; soup is lighter.
('Wonton Mee (dry)',  510, 22, 65, 18, '1 plate'),
('Wonton Mee (soup)', 385, 19, 60,  8, '1 bowl'),

-- Bak Chor Mee variant
-- Base (591 kcal) = dry (lard + vinegar-oil dressing). Soup is significantly lighter.
('Bak Chor Mee (soup)', 478, 27, 71, 12, '1 bowl'),

-- Fish Ball Noodles variant
-- Base "Fish Ball Noodles Soup" (386 kcal). Dry with chili oil adds ~60 kcal.
('Fish Ball Noodles (dry)', 448, 22, 60, 13, '1 plate'),

-- Prawn Noodles variant
-- Base "Prawn Noodle Soup" (468 kcal). Dry with sambal adds ~80 kcal.
('Prawn Noodles (dry)', 548, 29, 63, 20, '1 plate'),

-- Mee Pok variant
-- Base "Mee Pok Dry" (530 kcal). Soup version is lighter (no lard dressing).
('Mee Pok (soup)', 458, 21, 68, 12, '1 bowl');
