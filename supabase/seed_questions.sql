-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Question Pool Seed — Phase 2
--
-- Run this in the Supabase SQL Editor AFTER schema.sql.
--
-- HOW PAYOUT QUESTIONS WORK
-- ─────────────────────────
-- For questions with type = 'payout', the correct_answer field
-- stores the PAYOUT RATIO as a decimal string (e.g. '35' for
-- 35:1, '1.5' for 3:2). The drill UI shows a randomised chip
-- stack; the agent types the dollar amount. Validation:
--   expected = totalBet × ratio  (with 2-cent tolerance)
--
-- For questions with type = 'multiple_choice', correct_answer
-- must EXACTLY match one of the strings in the options array.
-- ============================================================

-- ─── Schema patch: add created_at if absent ──────────────────
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================
-- ROULETTE  (31 payout questions)
-- Chip display shows a random bet; agent calculates payout.
-- ============================================================

-- Straight Up  35:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins a straight up bet on a single number. Calculate the correct payout.',NULL,'35','Straight up (single number) bets pay 35 to 1 in Roulette.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','The ball lands on the player''s chosen number — they have a straight up bet. What is the payout?',NULL,'35','A straight up bet covers one number and pays 35:1.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Player placed chips directly on a single number and it hits. Calculate the payout on their wagered amount.',NULL,'35','Straight up bets pay 35 to 1. Multiply the total bet by 35.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A winning straight up bet in double-zero Roulette. How much do you pay per unit wagered?',NULL,'35','Straight up pays 35:1 on both single-zero and double-zero wheels.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Number 17 hits and a player has chips stacked straight up on it. What is the correct payout?',NULL,'35','Straight up (single number) bets pay 35 to 1.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins their straight up wager. Calculate the winnings on the bet shown.',NULL,'35','Straight up pays 35:1. Total payout = bet × 35.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Straight up bet hits in Roulette — player wins. What is owed on their chips wagered?',NULL,'35','Straight up bets pay 35 to 1.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','The dealer calls "straight up winner." Calculate the payout on the player''s bet.',NULL,'35','Straight up pays 35:1.','roulette',FALSE,1,10,TRUE);

-- Split  17:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins a split bet (chips on the line between 2 adjacent numbers). Calculate the payout.',NULL,'17','Split bets cover 2 numbers and pay 17 to 1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Ball lands on one of a player''s two split numbers. What is the correct payout?',NULL,'17','A split bet (2 numbers) pays 17:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A split bet wins in Roulette. Calculate the payout on the player''s wagered chips.',NULL,'17','Split bets pay 17 to 1. Multiply total bet by 17.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Player wins their 2-number split wager. What do you pay on the bet shown?',NULL,'17','A split (2-number) bet pays 17:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Chips placed on the border of two numbers — one hits. Calculate the correct payout.',NULL,'17','Split bets cover 2 numbers and pay 17:1.','roulette',FALSE,2,10,TRUE);

-- Street / Row  11:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins a street bet (covering an entire row of 3 numbers). Calculate the payout.',NULL,'11','Street (row) bets cover 3 consecutive numbers and pay 11 to 1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','The ball lands on one of a player''s street bet numbers. What is the correct payout?',NULL,'11','A street bet (3 numbers in a row) pays 11:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A street (row) bet wins in Roulette. Calculate the payout on the bet shown.',NULL,'11','Street bets pay 11 to 1. Multiply total bet by 11.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Chips placed at the end of a 3-number row hit. What do you pay on the player''s wager?',NULL,'11','Street bets cover 3 numbers and pay 11:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Player wins a winning 3-number row bet in Roulette. Calculate the correct payout.',NULL,'11','Street (row) bets pay 11:1.','roulette',FALSE,2,10,TRUE);

-- Corner / Square  8:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins a corner bet (chips on the intersection of 4 numbers). Calculate the payout.',NULL,'8','Corner (square) bets cover 4 numbers and pay 8 to 1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Ball lands on one of a player''s four corner-bet numbers. What is the correct payout?',NULL,'8','A corner (4-number) bet pays 8:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A corner (4-number square) bet wins in Roulette. Calculate the payout on the bet shown.',NULL,'8','Corner bets pay 8 to 1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Chips placed at the corner of four numbers — one hits. Calculate the correct payout.',NULL,'8','Corner bets cover 4 numbers and pay 8:1.','roulette',FALSE,2,10,TRUE);

-- Six Line  5:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins a six line bet (covering 2 consecutive rows — 6 numbers). Calculate the payout.',NULL,'5','Six line (double street) bets cover 6 numbers and pay 5 to 1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Ball lands on one of a player''s six line bet numbers. What is the correct payout?',NULL,'5','A six line (6-number) bet pays 5:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A winning six-line (double street) bet in Roulette. Calculate the payout on the bet shown.',NULL,'5','Six line bets pay 5:1.','roulette',FALSE,2,10,TRUE);

-- Dozen / Column  2:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins a dozen bet (1st, 2nd, or 3rd 12 numbers). Calculate the payout.',NULL,'2','Dozen bets cover 12 numbers and pay 2 to 1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A column bet wins in Roulette (covering 12 numbers in a column). What is the correct payout?',NULL,'2','Column bets cover 12 numbers and pay 2:1.','roulette',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Player wins a dozen or column wager. Calculate the payout on the bet shown.',NULL,'2','Dozen and column bets both pay 2:1.','roulette',FALSE,2,10,TRUE);

-- Even Money  1:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Roulette'),'payout','A player wins an even money bet (Red/Black, Odd/Even, or High/Low). Calculate the payout.',NULL,'1','Even money bets pay 1 to 1 — the payout equals the bet amount.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','The Red bet wins — player has chips on Red. What is the correct payout?',NULL,'1','Red, Black, Odd, Even, 1–18, and 19–36 all pay 1:1.','roulette',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Roulette'),'payout','Player wins an Odd/Even or High/Low wager in Roulette. Calculate the correct payout.',NULL,'1','Even money bets (Red, Black, Odd, Even, Low, High) pay 1:1.','roulette',FALSE,1,10,TRUE);


-- ============================================================
-- THREE CARD POKER — PAIR PLUS  (30 payout questions)
-- ============================================================

-- Pair  1:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Pair on their Pair Plus bet. Calculate the correct payout.',NULL,'1','A Pair on the Pair Plus wager pays 1 to 1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet results in a Pair. What do you pay on the player''s chips wagered?',NULL,'1','Pair Plus: Pair pays 1:1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A Pair wins on the Three Card Poker Pair Plus side bet. Calculate the payout.',NULL,'1','Pair Plus: Pair pays 1:1. Payout equals the bet amount.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins Pair Plus with a Pair. What is the correct payout on their wager?',NULL,'1','Pair Plus Pair payout: 1:1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet hits with a Pair in Three Card Poker. Calculate the payout.',NULL,'1','Pair Plus: Pair pays 1 to 1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Three Card Poker dealer calls a winning Pair on Pair Plus. Calculate the payout.',NULL,'1','A Pair on Pair Plus pays even money (1:1).','three_card_poker',FALSE,1,10,TRUE);

-- Flush  3:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Flush on their Pair Plus bet. Calculate the correct payout.',NULL,'3','A Flush on the Pair Plus wager pays 3 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet results in a Flush. What do you pay on the player''s wagered chips?',NULL,'3','Pair Plus: Flush pays 3:1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A Flush wins on the Three Card Poker Pair Plus side bet. Calculate the payout.',NULL,'3','Pair Plus: Flush pays 3 to 1. Multiply bet by 3.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins Pair Plus with a Flush. What is the correct payout?',NULL,'3','Pair Plus Flush payout: 3:1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus hits with a Flush in Three Card Poker. Calculate the payout.',NULL,'3','Pair Plus: Flush pays 3 to 1.','three_card_poker',FALSE,2,10,TRUE);

-- Straight  6:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Straight on their Pair Plus bet. Calculate the correct payout.',NULL,'6','A Straight on the Pair Plus wager pays 6 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet results in a Straight. What do you pay on the player''s wagered chips?',NULL,'6','Pair Plus: Straight pays 6:1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A Straight wins on the Three Card Poker Pair Plus side bet. Calculate the payout.',NULL,'6','Pair Plus: Straight pays 6 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins Pair Plus with a Straight. What is the correct payout?',NULL,'6','Pair Plus Straight payout: 6:1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus hits with a Straight in Three Card Poker. Calculate the payout.',NULL,'6','Pair Plus: Straight pays 6 to 1.','three_card_poker',FALSE,2,10,TRUE);

-- Three of a Kind  30:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has Three of a Kind on their Pair Plus bet. Calculate the correct payout.',NULL,'30','Three of a Kind on Pair Plus pays 30 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet results in Three of a Kind. What do you pay on the player''s wagered chips?',NULL,'30','Pair Plus: Three of a Kind pays 30:1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Three of a Kind wins on the Three Card Poker Pair Plus side bet. Calculate the payout.',NULL,'30','Pair Plus: Three of a Kind pays 30 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins Pair Plus with Three of a Kind. What is the correct payout?',NULL,'30','Pair Plus Three of a Kind payout: 30:1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus hits with Three of a Kind in Three Card Poker. Calculate the payout.',NULL,'30','Pair Plus: Three of a Kind pays 30 to 1.','three_card_poker',FALSE,2,10,TRUE);

-- Straight Flush  40:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Straight Flush on their Pair Plus bet. Calculate the correct payout.',NULL,'40','A Straight Flush on Pair Plus pays 40 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet results in a Straight Flush. What do you pay on the player''s wagered chips?',NULL,'40','Pair Plus: Straight Flush pays 40:1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A Straight Flush wins on the Three Card Poker Pair Plus side bet. Calculate the payout.',NULL,'40','Pair Plus: Straight Flush pays 40 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins Pair Plus with a Straight Flush. What is the correct payout?',NULL,'40','Pair Plus Straight Flush payout: 40:1.','three_card_poker',FALSE,3,10,TRUE);

-- Mini Royal (A-K-Q suited)  50:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Mini Royal on their Pair Plus bet. Calculate the correct payout.',NULL,'50','Mini Royal (A-K-Q suited) on Pair Plus pays 50 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet results in a Mini Royal. What is the payout?',NULL,'50','Pair Plus: Mini Royal (A-K-Q suited) pays 50:1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A-K-Q suited wins on the Three Card Poker Pair Plus. Calculate the payout.',NULL,'50','Pair Plus: Mini Royal pays 50 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins Pair Plus with a Mini Royal. What is the correct payout?',NULL,'50','Pair Plus Mini Royal payout: 50:1.','three_card_poker',FALSE,3,10,TRUE);

-- ============================================================
-- THREE CARD POKER — ANTE BONUS  (15 payout questions)
-- Pay table: Straight 1:1 | Three of a Kind 4:1 | Straight Flush 5:1
-- category = 'ante_bonus' keeps these separate from Pair Plus questions
-- ============================================================

-- Straight  1:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Straight on their Ante. The Ante Bonus pays out. Calculate the correct payout.',NULL,'1','A Straight pays 1:1 on the Ante Bonus.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus: Player''s final hand is a Straight. Calculate the payout on their Ante bet.',NULL,'1','Ante Bonus: Straight pays 1:1.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins the Ante Bonus with a Straight. What is the correct payout?',NULL,'1','Straight pays 1 to 1 on the Ante Bonus.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus pays on a Straight. Calculate the payout on the Ante wager shown.',NULL,'1','Ante Bonus: Straight pays 1:1.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player''s hand qualifies for the Ante Bonus with a Straight. Calculate the payout.',NULL,'1','A Straight on the Ante Bonus pays even money (1:1).','ante_bonus',FALSE,1,10,TRUE);

-- Three of a Kind  4:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has Three of a Kind on their Ante. The Ante Bonus pays out. Calculate the correct payout.',NULL,'4','Three of a Kind pays 4:1 on the Ante Bonus.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus: Player''s final hand is Three of a Kind. Calculate the payout on their Ante bet.',NULL,'4','Ante Bonus: Three of a Kind pays 4:1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins the Ante Bonus with Three of a Kind. What is the correct payout?',NULL,'4','Three of a Kind pays 4 to 1 on the Ante Bonus.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus pays on Three of a Kind. Calculate the payout on the Ante wager shown.',NULL,'4','Ante Bonus: Three of a Kind pays 4:1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player''s hand qualifies for the Ante Bonus with Three of a Kind. Calculate the payout.',NULL,'4','Three of a Kind on the Ante Bonus pays 4 to 1.','ante_bonus',FALSE,2,10,TRUE);

-- Straight Flush  5:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player has a Straight Flush on their Ante. The Ante Bonus pays out. Calculate the correct payout.',NULL,'5','A Straight Flush pays 5:1 on the Ante Bonus.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus: Player''s final hand is a Straight Flush. Calculate the payout on their Ante bet.',NULL,'5','Ante Bonus: Straight Flush pays 5:1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player wins the Ante Bonus with a Straight Flush. What is the correct payout?',NULL,'5','Straight Flush pays 5 to 1 on the Ante Bonus.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus pays on a Straight Flush. Calculate the payout on the Ante wager shown.',NULL,'5','Ante Bonus: Straight Flush pays 5:1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Player''s hand qualifies for the Ante Bonus with a Straight Flush. Calculate the payout.',NULL,'5','A Straight Flush on the Ante Bonus pays 5 to 1.','ante_bonus',FALSE,2,10,TRUE);


-- ============================================================
-- LET IT RIDE  (30 payout questions)
-- correct_answer = payout ratio per unit wagered.
-- The chip display shows the TOTAL of all active bets;
-- the ratio is applied to that total.
-- ============================================================

-- Pair of 10s or better  1:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Pair of Tens or better. Calculate the total payout on all active bets.',NULL,'1','A Pair of Tens or better pays 1:1 on each active Let It Ride bet.','let_it_ride',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: Player holds a Pair of Jacks. What is the payout on their total active wager?',NULL,'1','Pair of Tens or better pays even money (1:1) in Let It Ride.','let_it_ride',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player wins Let It Ride with a Pair of Aces. Calculate the total payout on active bets.',NULL,'1','Pair 10s or better: 1:1 payout per active bet.','let_it_ride',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','A winning Pair of Queens in Let It Ride. Calculate the payout on the total active wager.',NULL,'1','Any pair of 10s or better pays 1:1 in Let It Ride.','let_it_ride',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer reveals a Pair of Kings. Calculate the total correct payout.',NULL,'1','Pair of Tens or better pays 1 to 1 per active bet.','let_it_ride',FALSE,1,10,TRUE);

-- Two Pair  2:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is Two Pair in Let It Ride. Calculate the total payout on active bets.',NULL,'2','Two Pair pays 2 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Two Pair wins in Let It Ride. Calculate the payout on the total active wager.',NULL,'2','Let It Ride: Two Pair pays 2:1.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: Player holds Two Pair. What is the correct payout on their total active bet?',NULL,'2','Two Pair: 2:1 per active bet in Let It Ride.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Winning Two Pair hand in Let It Ride. Calculate the total correct payout.',NULL,'2','Two Pair pays 2 to 1 on all active bets.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer calls a Two Pair winner. Calculate the payout on the wager shown.',NULL,'2','Two Pair pays 2:1 in Let It Ride.','let_it_ride',FALSE,2,10,TRUE);

-- Three of a Kind  3:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is Three of a Kind in Let It Ride. Calculate the total payout on active bets.',NULL,'3','Three of a Kind pays 3 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Three of a Kind wins in Let It Ride. What is the correct total payout on the wager shown?',NULL,'3','Let It Ride: Three of a Kind pays 3:1.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: Player holds Three of a Kind. Calculate the payout on their total active bet.',NULL,'3','Three of a Kind: 3:1 per active bet in Let It Ride.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Winning Three of a Kind in Let It Ride — calculate the total correct payout.',NULL,'3','Three of a Kind pays 3 to 1 on all active bets.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer calls Three of a Kind. Calculate the payout on the wagered amount shown.',NULL,'3','Three of a Kind pays 3:1 in Let It Ride.','let_it_ride',FALSE,2,10,TRUE);

-- Straight  5:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Straight in Let It Ride. Calculate the total payout on active bets.',NULL,'5','A Straight pays 5 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','A Straight wins in Let It Ride. What is the correct total payout on the wager shown?',NULL,'5','Let It Ride: Straight pays 5:1.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: Player holds a Straight. Calculate the payout on their total active wager.',NULL,'5','Straight: 5:1 per active bet in Let It Ride.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Winning Straight in Let It Ride — calculate the total correct payout.',NULL,'5','A Straight pays 5 to 1 on all active bets.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer calls a Straight winner. Calculate the payout on the wagered amount shown.',NULL,'5','Straight pays 5:1 in Let It Ride.','let_it_ride',FALSE,2,10,TRUE);

-- Flush  8:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Flush in Let It Ride. Calculate the total payout on active bets.',NULL,'8','A Flush pays 8 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','A Flush wins in Let It Ride. What is the correct total payout on the wager shown?',NULL,'8','Let It Ride: Flush pays 8:1.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: Player holds a Flush. Calculate the payout on their total active wager.',NULL,'8','Flush: 8:1 per active bet in Let It Ride.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Winning Flush hand in Let It Ride — calculate the total correct payout.',NULL,'8','A Flush pays 8 to 1 on all active bets.','let_it_ride',FALSE,2,10,TRUE);

-- Full House  11:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Full House in Let It Ride. Calculate the total payout on active bets.',NULL,'11','A Full House pays 11 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','A Full House wins in Let It Ride. What is the correct total payout on the wager shown?',NULL,'11','Let It Ride: Full House pays 11:1.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: Player holds a Full House. Calculate the payout on their total active wager.',NULL,'11','Full House: 11:1 per active bet in Let It Ride.','let_it_ride',FALSE,3,10,TRUE);

-- Four of a Kind  50:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is Four of a Kind in Let It Ride. Calculate the total payout on active bets.',NULL,'50','Four of a Kind pays 50 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Four of a Kind wins in Let It Ride. What is the correct total payout on the wager shown?',NULL,'50','Let It Ride: Four of a Kind pays 50:1.','let_it_ride',FALSE,3,10,TRUE);

-- Straight Flush  200:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Straight Flush in Let It Ride. Calculate the total payout on active bets.',NULL,'200','A Straight Flush pays 200 to 1 on each active Let It Ride bet.','let_it_ride',FALSE,3,10,TRUE);


-- ============================================================
-- ULTIMATE TEXAS HOLD''EM — TRIPS SIDE BET  (30 payout questions)
-- ============================================================

-- Three of a Kind  3:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with Three of a Kind. Calculate the payout.',NULL,'3','Trips bet: Three of a Kind pays 3 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Three of a Kind wins on the Ultimate Texas Hold''em Trips bet. What is the correct payout?',NULL,'3','UTH Trips: Three of a Kind pays 3:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Trips bet hits with Three of a Kind in UTH. Calculate the payout on the bet shown.',NULL,'3','UTH Trips: Three of a Kind pays 3 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player''s UTH Trips wager wins with Three of a Kind. Calculate the correct payout.',NULL,'3','Trips: Three of a Kind pays 3:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','UTH dealer calls Three of a Kind on the Trips side bet. What do you pay?',NULL,'3','Three of a Kind on UTH Trips pays 3 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE);

-- Straight  4:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with a Straight. Calculate the payout.',NULL,'4','Trips bet: Straight pays 4 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','A Straight wins on the Ultimate Texas Hold''em Trips bet. What is the correct payout?',NULL,'4','UTH Trips: Straight pays 4:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Trips bet hits with a Straight in UTH. Calculate the payout on the bet shown.',NULL,'4','UTH Trips: Straight pays 4 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player''s UTH Trips wager wins with a Straight. Calculate the correct payout.',NULL,'4','Trips: Straight pays 4:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','UTH dealer calls a Straight on the Trips side bet. What do you pay?',NULL,'4','Straight on UTH Trips pays 4 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE);

-- Flush  7:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with a Flush. Calculate the payout.',NULL,'7','Trips bet: Flush pays 7 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','A Flush wins on the Ultimate Texas Hold''em Trips bet. What is the correct payout?',NULL,'7','UTH Trips: Flush pays 7:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Trips bet hits with a Flush in UTH. Calculate the payout on the bet shown.',NULL,'7','UTH Trips: Flush pays 7 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player''s UTH Trips wager wins with a Flush. Calculate the correct payout.',NULL,'7','Trips: Flush pays 7:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','UTH dealer calls a Flush on the Trips side bet. What do you pay?',NULL,'7','Flush on UTH Trips pays 7 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE);

-- Full House  8:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with a Full House. Calculate the payout.',NULL,'8','Trips bet: Full House pays 8 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','A Full House wins on the Ultimate Texas Hold''em Trips bet. What is the correct payout?',NULL,'8','UTH Trips: Full House pays 8:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Trips bet hits with a Full House in UTH. Calculate the payout on the bet shown.',NULL,'8','UTH Trips: Full House pays 8 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player''s UTH Trips wager wins with a Full House. Calculate the correct payout.',NULL,'8','Trips: Full House pays 8:1.','ultimate_texas_holdem',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','UTH dealer calls a Full House on the Trips side bet. What do you pay?',NULL,'8','Full House on UTH Trips pays 8 to 1.','ultimate_texas_holdem',FALSE,2,10,TRUE);

-- Four of a Kind  30:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with Four of a Kind. Calculate the payout.',NULL,'30','Trips bet: Four of a Kind pays 30 to 1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Four of a Kind wins on the Ultimate Texas Hold''em Trips bet. What is the correct payout?',NULL,'30','UTH Trips: Four of a Kind pays 30:1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Trips bet hits with Four of a Kind in UTH. Calculate the payout on the bet shown.',NULL,'30','UTH Trips: Four of a Kind pays 30 to 1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player''s UTH Trips wager wins with Four of a Kind. Calculate the correct payout.',NULL,'30','Trips: Four of a Kind pays 30:1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','UTH dealer calls Four of a Kind on the Trips side bet. What do you pay?',NULL,'30','Four of a Kind on UTH Trips pays 30 to 1.','ultimate_texas_holdem',FALSE,3,10,TRUE);

-- Straight Flush  40:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with a Straight Flush. Calculate the payout.',NULL,'40','Trips bet: Straight Flush pays 40 to 1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','A Straight Flush wins on the UTH Trips bet. What is the correct payout?',NULL,'40','UTH Trips: Straight Flush pays 40:1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Trips bet hits with a Straight Flush in UTH. Calculate the payout on the bet shown.',NULL,'40','UTH Trips: Straight Flush pays 40 to 1.','ultimate_texas_holdem',FALSE,3,10,TRUE);

-- Royal Flush  50:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','Player wins the UTH Trips side bet with a Royal Flush. Calculate the payout.',NULL,'50','Trips bet: Royal Flush pays 50 to 1.','ultimate_texas_holdem',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Ultimate Texas Hold''em'),'payout','A Royal Flush wins on the UTH Trips bet. What is the correct payout?',NULL,'50','UTH Trips: Royal Flush pays 50:1.','ultimate_texas_holdem',FALSE,3,10,TRUE);


-- ============================================================
-- BLACKJACK — MULTIPLE CHOICE  (30 questions)
-- ============================================================

-- Payout Calculations (difficulty 1–2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $25 and receives a blackjack. The table pays 3:2. What is the correct payout?','["$37.50","$50.00","$25.00","$12.50"]','$37.50','3:2 on $25: $25 × 1.5 = $37.50.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $100 and receives a blackjack (3:2 payout). What is the correct payout?','["$150","$200","$100","$133"]','$150','3:2 on $100: $100 × 1.5 = $150.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $40 and receives a blackjack (3:2). What is the correct payout?','["$60","$80","$40","$55"]','$60','3:2 on $40: $40 × 1.5 = $60.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $75 and receives a blackjack (3:2). What is the correct payout?','["$112.50","$150","$75","$87.50"]','$112.50','3:2 on $75: $75 × 1.5 = $112.50.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $200 and receives a blackjack (3:2). What is the correct payout?','["$300","$400","$200","$250"]','$300','3:2 on $200: $200 × 1.5 = $300.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $60 and receives a blackjack (3:2). What is the correct payout?','["$90","$120","$60","$80"]','$90','3:2 on $60: $60 × 1.5 = $90.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $50 and wins a regular hand (1:1). What is the payout?','["$50","$75","$100","$25"]','$50','Regular win pays 1:1 — payout equals the bet amount.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player doubles down, placing an additional $100 on their original $100 bet, and wins. How much does the dealer pay out?','["$200","$100","$300","$150"]','$200','The total bet is $200; winning pays 1:1, so the dealer pays $200.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A table pays 6:5 on blackjack. A player bets $25. What is the correct payout?','["$30","$37.50","$25","$20"]','$30','6:5 on $25: $25 × 1.2 = $30.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player bets $80 and receives a blackjack (3:2). What is the correct payout?','["$120","$160","$80","$100"]','$120','3:2 on $80: $80 × 1.5 = $120.','blackjack',FALSE,2,10,TRUE);

-- Side Bets (difficulty 2–3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $25 on Perfect Pairs and gets a Perfect Pair (same rank and suit from different decks). The payout is 25:1. How much is paid?','["$625","$250","$300","$125"]','$625','25:1 on $25: $25 × 25 = $625.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $10 on Perfect Pairs and gets a Colored Pair (same color, different suit). The payout is 12:1. How much is paid?','["$120","$100","$60","$240"]','$120','12:1 on $10: $10 × 12 = $120.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $20 on Perfect Pairs and gets a Mixed Pair (different color). The payout is 5:1. How much is paid?','["$100","$200","$40","$80"]','$100','5:1 on $20: $20 × 5 = $100.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $15 on 21+3. Their cards and the dealer''s up card form Suited Trips. The payout is 100:1. How much is paid?','["$1,500","$150","$1,000","$500"]','$1,500','100:1 on $15: $15 × 100 = $1,500.','blackjack',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $10 on 21+3. Their hand forms a Straight Flush. The payout is 35:1. How much is paid?','["$350","$100","$35","$700"]','$350','35:1 on $10: $10 × 35 = $350.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $100 on Insurance. The dealer shows an Ace and has a blackjack. Insurance pays 2:1. How much is paid?','["$200","$100","$150","$50"]','$200','Insurance pays 2:1: $100 × 2 = $200.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $10 on 21+3. Their cards form Three of a Kind (suited). The payout is 100:1. How much is paid?','["$1,000","$100","$300","$500"]','$1,000','100:1 on $10: $10 × 100 = $1,000.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $40 on 21+3. Their cards form a Flush. The payout is 5:1. How much is paid?','["$200","$400","$40","$100"]','$200','5:1 on $40: $40 × 5 = $200.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $50 on Lucky Lucky. Their hand is 7-7-7 suited. The payout is 200:1. How much is paid?','["$10,000","$5,000","$1,000","$2,500"]','$10,000','200:1 on $50: $50 × 200 = $10,000.','blackjack',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Player bets $25 on Insurance. The dealer has blackjack. Insurance pays 2:1. How much is paid?','["$50","$25","$75","$100"]','$50','Insurance pays 2:1: $25 × 2 = $50.','blackjack',FALSE,1,10,TRUE);

-- Game Protection (difficulty 2–3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','After a win, you observe that a player''s bet contains more chips than were originally placed. This is known as:','["Past posting","Pinching","Capping","Mucking"]','Past posting','Past posting is adding chips to a winning bet after the outcome is known.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player removes chips from their bet before the dealer collects a losing wager. This is called:','["Pinching","Past posting","Capping","Spoofing"]','Pinching','Pinching is removing chips from a losing bet before it is collected.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','You observe that a player''s bet stack has a high-denomination chip concealed at the bottom under lower-denomination chips. This cheating method is called:','["Capping","Past posting","Pinching","Chip dumping"]','Capping','Capping is hiding a high-value chip beneath a legally placed bet.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player consistently raises their bet significantly when the remaining shoe is favorable and lowers it when it is unfavorable. This is a sign of:','["Card counting / bet spreading","Martingale progression","Normal variance betting","System play — no concern"]','Card counting / bet spreading','Large bet variation correlated with shoe composition is a classic card-counting indicator.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','You notice several cards have barely visible marks on their backs. The correct immediate action is:','["Alert the supervisor and remove the deck from play","Continue dealing but monitor closely","Replace only the marked cards","Ask a colleague if they notice anything"]','Alert the supervisor and remove the deck from play','Marked cards require immediate escalation and removal from play per surveillance protocol.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player consistently peeks at adjacent players'' cards before making their own decision. The correct action is:','["Immediately alert the supervisor","Ask the player to stop once, then alert the supervisor if it continues","Ignore it — peeking is not a violation","Ask the player to move seats"]','Immediately alert the supervisor','Observing other players'' hole cards for advantage is a table integrity concern requiring supervisor notification.','blackjack',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','An agent in the pit signals to an accomplice at the table about the dealer''s hole card. This is known as:','["Hole card steering","Card marking","Wonging","Bet capping"]','Hole card steering','Hole card steering involves an insider communicating the dealer''s unexposed card to a player accomplice.','blackjack',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player asks the dealer to show their hole card before it is revealed. The correct response is:','["Refuse and follow standard procedure","Show the card only to that player","Show the card if no other players object","Call the supervisor to decide"]','Refuse and follow standard procedure','Hole cards are never revealed early under any circumstances. Dealers must follow standard procedure.','blackjack',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','A player consistently acts out of turn and appears to be studying the dealer''s burn card procedure. This behaviour may indicate:','["Dealer tell exploitation","Normal impatience","Card counting","A distraction technique"]','Dealer tell exploitation','Observing the dealer''s burn card procedure to gain information about the card is a form of advantage play.','blackjack',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice','Two players at the same table appear to be signalling each other about their hands. This is called:','["Collusion","Wonging","Mucking","Capping"]','Collusion','Collusion is players cooperating to gain an illegal advantage over the house.','blackjack',FALSE,3,10,TRUE);


-- ============================================================
-- SHARED PROCEDURE QUESTIONS  (15 multiple choice)
-- game_id = NULL, is_procedure = TRUE
-- ============================================================

INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
(NULL,'multiple_choice','What is the correct procedure when a player wants to color up their chips?','["Count chips, announce the color-up, spread originals, then present the higher-denomination chips","Simply swap the chips without any announcement","Color up only when the pit boss specifically requests it","Perform the color-up between every hand to keep the rack tidy"]','Count chips, announce the color-up, spread originals, then present the higher-denomination chips','The count must be verified visibly and verbally for both the player and surveillance before exchanging denominations.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','A player presents $500 cash to buy chips. What is the correct procedure?','["Place cash flat on the felt, call out the denomination, wait for approval if required, then push chips to the player","Put chips out and take the cash simultaneously to save time","Hold the cash in hand and give chips first","Let the player exchange cash directly with another player"]','Place cash flat on the felt, call out the denomination, wait for approval if required, then push chips to the player','Cash must be placed on the felt (never handed dealer to player) and the amount called out for surveillance confirmation.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','A player tips the dealer a chip. What should the dealer do?','["Announce the toke, then place it in the toke box or bet it per house policy","Pocket it immediately and discreetly","Refuse all tips as per policy","Place it in the chip rack without announcing it"]','Announce the toke, then place it in the toke box or bet it per house policy','Tips (tokes) must be acknowledged verbally and handled per house procedure so surveillance can document them.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','During a table fill, who is responsible for verifying the chip count?','["Both the dealer and the supervisor/floor person, with surveillance documenting","Only the dealer receiving the chips","Only the chip-carrier from the cage","The cage cashier alone — no table verification needed"]','Both the dealer and the supervisor/floor person, with surveillance documenting','A fill requires dual verification at the table (dealer + supervisor) and is documented by surveillance.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','A player disputes a payout after chips have been exchanged. What is the correct procedure?','["Stop play, call the supervisor immediately, and preserve the table layout as-is","Pay what the player claims to avoid a scene","Ignore the dispute if you are confident in your count","Ask another dealer to settle the dispute"]','Stop play, call the supervisor immediately, and preserve the table layout as-is','Disputes require freezing the table state for supervisor review and potential surveillance pull.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','How should a dealer handle a chip that has been dropped on the floor?','["Announce it, let it land, and have the supervisor verify its value before it is retrieved","Pick it up immediately without announcement","Ask the player to retrieve it","Leave it on the floor until the shift ends"]','Announce it, let it land, and have the supervisor verify its value before it is retrieved','Dropped chips must be announced so surveillance can track the chip and its denomination is confirmed.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','What is a table "credit" in casino operations?','["The removal of excess chips from a table and their return to the cage","A cash loan extended to a player by the casino","A bonus payout decided by the pit boss","A tip given to a dealer by a supervisor"]','The removal of excess chips from a table and their return to the cage','A credit (also called a fill in reverse) moves excess chips from the table back to the main bank.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','What is the correct way for a dealer to pass chips to a player?','["Slide chips across the felt — never hand them directly from the dealer''s hand to the player''s hand","Hand them directly into the player''s hand for speed","Toss the chips toward the player''s betting area","Let the player reach into the rack to take them"]','Slide chips across the felt — never hand them directly from the dealer''s hand to the player''s hand','Chips must always be slid across the felt, never hand-to-hand, so the transaction is visible to surveillance.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','When should a fresh deck be introduced at a table?','["Per house policy: at shift start, when directed by a supervisor, or when cards are suspected to be compromised","Only when every card in the shoe has been dealt","Every 30 minutes as a standard interval","Whenever a player at the table requests it"]','Per house policy: at shift start, when directed by a supervisor, or when cards are suspected to be compromised','Deck changes are governed by house policy and supervisor direction — not at player request or fixed intervals alone.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','A card is accidentally flashed to players during the shuffle or deal. What should the dealer do?','["Announce the exposed card to the supervisor and follow house procedure (typically burn the card)","Ignore it and continue dealing without disruption","Remove it from play without informing anyone","Ask the player nearest the card whether they want to keep it"]','Announce the exposed card to the supervisor and follow house procedure (typically burn the card)','Accidentally exposed cards must be declared to the supervisor and handled per house procedure to maintain game integrity.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','A player places a bet after the dealer calls "No more bets." What is the correct action?','["Decline the late bet and return it to the player","Accept the bet — the player was close to the cutoff","Let the supervisor decide whether to accept it","Void the entire hand"]','Decline the late bet and return it to the player','Bets placed after "no more bets" are not valid and must be returned. Accepting them would compromise game integrity.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','What does it mean when a dealer calls "locking up" a bet?','["The dealer covers the bet to confirm it is placed and will not be changed","A player locks their betting spot for the next hand","The supervisor locks the table to investigate a dispute","The dealer checks for hidden chips beneath the top layer"]','The dealer covers the bet to confirm it is placed and will not be changed','Locking up a bet (also called "capping" in a legitimate sense) signals the bet is confirmed before the deal.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','From a surveillance perspective, what is the primary reason chips must always be kept in open, visible stacks on the table?','["So surveillance cameras can accurately track all chip movement and confirm payouts","To make it easier for players to count their chips","To comply with ergonomic regulations for dealers","To speed up color-up requests"]','So surveillance cameras can accurately track all chip movement and confirm payouts','Chip visibility is fundamental to surveillance operations — it enables real-time audit of all transactions.','procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','A player asks to change their bet after cards have been dealt. What is the correct response?','["Bets may not be altered once the deal has begun — inform the player and continue","Allow the change if the first card has not yet been seen","Allow the change if the supervisor approves","Allow the change if no other players object"]','Bets may not be altered once the deal has begun — inform the player and continue','Once dealing starts, bet modifications are not permitted. This rule exists to prevent past-posting and pinching.','procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','A player is observed placing a chip under the table and appears to be exchanging it with someone nearby. What should surveillance do?','["Document the behaviour with timestamp and camera angles, then alert the shift supervisor immediately","Wait to see if it happens again before reporting","Approach the player directly and ask them to stop","Assume it is innocent — no action needed"]','Document the behaviour with timestamp and camera angles, then alert the shift supervisor immediately','Potential chip-passing must be documented and escalated immediately. Direct intervention by surveillance is not appropriate — that is the floor supervisor''s role.','procedure',TRUE,3,10,TRUE);


-- ============================================================
-- Verify counts
-- ============================================================
SELECT
  COALESCE(g.name, 'Procedures (shared)') AS game,
  COUNT(*)                                 AS question_count
FROM public.questions q
LEFT JOIN public.games g ON g.id = q.game_id
GROUP BY g.name
ORDER BY g.name NULLS LAST;

-- ─── TCP top-up: one extra Mini Royal to reach 30 ───────────
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES ((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus bet wins with a Mini Royal. What is the total payout on the player''s wager?',NULL,'50','Mini Royal (A-K-Q suited) on Pair Plus pays 50 to 1.','three_card_poker',FALSE,3,10,TRUE);
