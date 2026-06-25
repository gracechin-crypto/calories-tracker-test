-- Dish variants where preparation method significantly affects calories
-- Original entries are unchanged; these are additive rows.

insert into public.food_items (name, calories, protein_g, carbs_g, fat_g, serving_description) values
-- Chicken rice with plain steamed white rice instead of oiled/flavoured rice (~110 kcal lower, ~8g less fat)
('Chicken Rice (white rice)', 497, 33, 72, 11, '1 plate'),

-- Char Kway Teow cooked with less oil, home-style (~200 kcal lower, ~17g less fat)
('Char Kway Teow (less oil)', 544, 22, 88, 14, '1 plate'),

-- Mee Goreng cooked with less oil (~180 kcal lower, ~18g less fat)
('Mee Goreng (less oil)', 480, 19, 85, 10, '1 plate');
