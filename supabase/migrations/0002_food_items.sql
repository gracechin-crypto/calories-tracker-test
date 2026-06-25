-- food_items reference table (public read, no RLS needed)
create table public.food_items (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  calories          integer not null,
  protein_g         numeric(6, 2) not null default 0,
  carbs_g           numeric(6, 2) not null default 0,
  fat_g             numeric(6, 2) not null default 0,
  serving_description text not null default '100g'
);

grant select on public.food_items to anon, authenticated;

-- add source column to meals
alter table public.meals
  add column if not exists name text,
  add column if not exists source text not null default 'ai_estimate';

-- Seed ~100 Singapore/SEA dishes (HPB / HealthHub SG data)
insert into public.food_items (name, calories, protein_g, carbs_g, fat_g, serving_description) values
-- Rice dishes
('Chicken Rice', 607, 33, 74, 19, '1 plate'),
('Nasi Lemak with Fried Chicken', 744, 31, 73, 36, '1 plate'),
('Nasi Lemak with Fried Egg', 529, 17, 70, 21, '1 plate'),
('Char Siew Rice', 607, 27, 83, 18, '1 plate'),
('Roast Duck Rice', 671, 36, 74, 24, '1 plate'),
('Nasi Briyani with Chicken', 661, 35, 83, 20, '1 plate'),
('Economy Rice with 2 Vegetables', 456, 12, 76, 13, '1 plate'),
('Economy Rice with Meat and Veg', 544, 22, 74, 18, '1 plate'),
('Claypot Chicken Rice', 650, 34, 82, 18, '1 serving'),
('Fried Rice', 570, 16, 84, 18, '1 plate'),
('Prawn Fried Rice', 605, 22, 82, 20, '1 plate'),
('Yangzhou Fried Rice', 622, 21, 84, 22, '1 plate'),
('Chicken Briyani', 656, 34, 82, 20, '1 plate'),
('Mutton Briyani', 700, 37, 80, 25, '1 plate'),

-- Noodle dishes
('Char Kway Teow', 744, 25, 91, 31, '1 plate'),
('Hokkien Mee', 673, 30, 82, 27, '1 plate'),
('Laksa', 589, 26, 58, 29, '1 bowl'),
('Bak Chor Mee', 591, 30, 73, 21, '1 bowl'),
('Wonton Mee', 439, 20, 63, 12, '1 bowl'),
('Fish Ball Noodles Soup', 386, 21, 59, 7, '1 bowl'),
('Prawn Noodle Soup', 468, 28, 61, 13, '1 bowl'),
('Beef Kway Teow Soup', 477, 31, 60, 13, '1 bowl'),
('Mee Siam', 519, 16, 83, 15, '1 plate'),
('Mee Goreng', 660, 22, 88, 25, '1 plate'),
('Mee Rebus', 499, 20, 72, 15, '1 plate'),
('Mee Pok Dry', 530, 22, 70, 20, '1 plate'),
('Kway Chap', 480, 28, 42, 20, '1 bowl'),
('Lor Mee', 487, 22, 66, 15, '1 bowl'),
('Duck Kway Chap', 550, 32, 44, 24, '1 bowl'),
('Maggi Goreng', 680, 18, 88, 28, '1 plate'),

-- Soups & porridge
('Bak Kut Teh', 367, 28, 10, 24, '1 bowl'),
('Chicken Congee', 222, 14, 30, 5, '1 bowl'),
('Fish Porridge', 233, 16, 30, 5, '1 bowl'),
('Sliced Fish Soup', 310, 26, 30, 10, '1 bowl'),
('Tom Yum Soup', 151, 12, 10, 7, '1 bowl'),
('Pork Rib Soup', 280, 24, 8, 16, '1 bowl'),
('Yong Tau Foo Soup', 350, 20, 38, 12, '1 bowl'),

-- Bread & pastry
('Kaya Toast with Butter', 285, 7, 38, 12, '2 slices'),
('Roti Prata Plain', 302, 7, 44, 11, '2 pieces'),
('Roti Prata with Egg', 388, 14, 44, 18, '2 pieces'),
('Roti Prata Coin', 281, 6, 40, 11, '6 pieces'),
('Teh Tarik', 148, 4, 23, 5, '1 cup'),
('Kopi O Kosong', 10, 0, 2, 0, '1 cup'),
('Kopi with Milk and Sugar', 103, 3, 15, 4, '1 cup'),
('Milo Dinosaur', 310, 7, 55, 8, '1 cup'),
('Bandung', 150, 2, 33, 2, '1 cup'),

-- Dim sum
('Har Gow (Prawn Dumpling)', 256, 13, 27, 10, '4 pieces'),
('Siew Mai', 282, 17, 23, 13, '4 pieces'),
('Char Siew Bao (Steamed)', 250, 10, 38, 7, '2 pieces'),
('Char Siew Bao (Baked)', 302, 10, 44, 10, '2 pieces'),
('Chee Cheong Fun', 264, 9, 40, 8, '1 portion'),
('Lo Mai Gai', 390, 17, 50, 14, '1 parcel'),
('Cheung Fun with Char Siew', 240, 9, 37, 7, '1 roll'),
('Wu Gok (Taro Dumpling)', 175, 6, 18, 9, '2 pieces'),
('Egg Tart', 218, 5, 28, 10, '2 pieces'),
('Turnip Cake (Chai Tow Kway)', 244, 7, 38, 8, '1 portion'),
('Black Chai Tow Kway', 294, 8, 40, 12, '1 plate'),
('White Chai Tow Kway', 268, 7, 39, 10, '1 plate'),

-- Malay dishes
('Satay Chicken', 396, 36, 23, 17, '10 sticks'),
('Satay Beef', 416, 38, 22, 19, '10 sticks'),
('Rendang Chicken', 304, 28, 10, 18, '1 serving'),
('Rendang Beef', 348, 32, 9, 22, '1 serving'),
('Murtabak Chicken', 566, 28, 64, 22, '1 piece'),
('Murtabak Mutton', 598, 30, 63, 26, '1 piece'),
('Lontong', 466, 16, 60, 18, '1 bowl'),
('Nasi Padang with 2 dishes', 620, 25, 76, 24, '1 plate'),
('Gado Gado', 340, 14, 35, 17, '1 plate'),

-- Indian dishes
('Thosai Plain', 197, 5, 36, 4, '2 pieces'),
('Thosai Masala', 296, 7, 48, 9, '1 piece'),
('Idli', 168, 6, 31, 2, '3 pieces'),
('Vadai', 207, 7, 25, 9, '2 pieces'),
('Fish Curry with Rice', 634, 34, 78, 20, '1 plate'),
('Chicken Curry with Rice', 640, 35, 79, 20, '1 plate'),
('Dal Curry', 185, 10, 28, 4, '1 bowl'),
('Prata Cheese', 382, 13, 44, 17, '2 pieces'),

-- Seafood
('Chilli Crab', 420, 28, 20, 26, '1 serving 200g'),
('Black Pepper Crab', 390, 27, 15, 26, '1 serving 200g'),
('Sambal Stingray', 290, 25, 12, 17, '1 serving'),
('Oyster Omelette', 340, 16, 28, 18, '1 plate'),
('Cereal Prawns', 450, 28, 28, 26, '1 serving'),

-- Snacks & sides
('Ngoh Hiang', 320, 18, 22, 17, '4 pieces'),
('Spring Roll', 196, 5, 23, 10, '2 rolls'),
('Popiah', 213, 8, 32, 7, '2 rolls'),
('Otah', 170, 16, 8, 9, '2 pieces'),
('Chicken Wing BBQ', 342, 32, 1, 23, '2 wings'),
('Rojak', 228, 6, 36, 8, '1 plate'),
('Ice Kachang', 251, 3, 58, 2, '1 bowl'),
('Chendol', 290, 3, 64, 5, '1 bowl'),
('Peanut Pancake (Min Jiang Kueh)', 326, 9, 47, 12, '1 piece'),
('Tau Huay (Tofu Pudding)', 102, 5, 17, 2, '1 bowl'),

-- Desserts
('Mango Pudding', 185, 4, 28, 7, '1 serving'),
('Durian (Mao Shan Wang)', 357, 4, 32, 25, '1 serving 100g'),
('Bubur Hitam', 240, 5, 47, 5, '1 bowl'),
('Tang Yuan', 270, 5, 48, 7, '1 bowl'),
('Soon Kueh', 195, 5, 35, 4, '3 pieces'),
('Ang Ku Kueh', 196, 4, 35, 5, '2 pieces'),
('Kueh Lapis', 193, 2, 33, 6, '3 pieces'),

-- Fast food / western common
('McDonald''s McSpicy', 528, 27, 48, 26, '1 burger'),
('KFC Original Chicken Piece', 290, 24, 12, 16, '1 piece'),
('Subway 6-inch Chicken Teriyaki', 330, 23, 47, 5, '1 sub');
