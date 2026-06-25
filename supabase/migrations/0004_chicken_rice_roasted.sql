-- Roasted chicken variants of chicken rice.
-- Roasted chicken with skin has ~7g more fat than steamed skinless per serving.
-- Reference: Roast Duck Rice in food_items = 671 kcal. All existing rows untouched.

insert into public.food_items (name, calories, protein_g, carbs_g, fat_g, serving_description) values
-- Roasted chicken + traditional oiled/flavoured rice
('Chicken Rice (roasted chicken, oily rice)', 670, 30, 74, 26, '1 plate'),

-- Roasted chicken + plain steamed white rice
('Chicken Rice (roasted chicken, white rice)', 560, 30, 72, 18, '1 plate');
