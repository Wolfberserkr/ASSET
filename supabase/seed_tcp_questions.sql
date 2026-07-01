-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Three Card Poker — Additional Payout Questions  (60)
--
-- Run this in the Supabase SQL Editor AFTER schema.sql / seed_questions.sql.
--
-- Payout questions store the PAYOUT RATIO in correct_answer (e.g. '15' for
-- 15:1). The drill shows a randomised chip stack on the active layout spot
-- and the agent types the dollar payout; validation is bet x ratio.
--
-- Bet types & the layout spot they render on:
--   category 'six_card_bonus'  -> 6 CARD BONUS spot   (30 questions)
--   category 'three_card_poker'-> PAIR PLUS spot      (18 questions)
--   category 'ante_bonus'      -> ANTE spot           (12 questions)
--
-- Difficulty is balanced: 20 easy (1) / 20 medium (2) / 20 hard (3).
-- ============================================================

-- Schema patch: add created_at if absent (matches seed_questions.sql)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================
-- Pay-table correction: Mini Royal on Pair Plus is 200:1 per the
-- Three Card Poker procedures manual (was seeded at 50:1). Idempotent —
-- re-running is a no-op once the value is already 200.
-- ============================================================
UPDATE public.questions
SET correct_answer = '200',
    explanation    = REPLACE(explanation, '50', '200')
WHERE category = 'three_card_poker'
  AND question_text ILIKE '%Mini Royal%'
  AND correct_answer = '50';


-- THREE CARD POKER — 6 CARD BONUS  (30 payout questions)
-- Pay table: Royal 1000:1 | Straight Flush 200:1 | Four of a Kind 50:1
--            Full House 25:1 | Flush 15:1 | Straight 10:1 | Three of a Kind 5:1
-- category = 'six_card_bonus' renders on the 6 CARD BONUS layout spot
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is Three of a Kind. Calculate the payout.',NULL,'5','6 Card Bonus: Three of a Kind pays 5 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes Three of a Kind from their six cards. What is the correct payout?',NULL,'5','6 Card Bonus: Three of a Kind pays 5 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with Three of a Kind. Calculate the payout on the bonus wager shown.',NULL,'5','6 Card Bonus: Three of a Kind pays 5 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on Three of a Kind. What do you pay on the wager shown?',NULL,'5','6 Card Bonus: Three of a Kind pays 5 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is a Straight. Calculate the payout.',NULL,'10','6 Card Bonus: Straight pays 10 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes a Straight from their six cards. What is the correct payout?',NULL,'10','6 Card Bonus: Straight pays 10 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with a Straight. Calculate the payout on the bonus wager shown.',NULL,'10','6 Card Bonus: Straight pays 10 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on a Straight. What do you pay on the wager shown?',NULL,'10','6 Card Bonus: Straight pays 10 to 1.','six_card_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is a Flush. Calculate the payout.',NULL,'15','6 Card Bonus: Flush pays 15 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes a Flush from their six cards. What is the correct payout?',NULL,'15','6 Card Bonus: Flush pays 15 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with a Flush. Calculate the payout on the bonus wager shown.',NULL,'15','6 Card Bonus: Flush pays 15 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on a Flush. What do you pay on the wager shown?',NULL,'15','6 Card Bonus: Flush pays 15 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is a Full House. Calculate the payout.',NULL,'25','6 Card Bonus: Full House pays 25 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes a Full House from their six cards. What is the correct payout?',NULL,'25','6 Card Bonus: Full House pays 25 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with a Full House. Calculate the payout on the bonus wager shown.',NULL,'25','6 Card Bonus: Full House pays 25 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on a Full House. What do you pay on the wager shown?',NULL,'25','6 Card Bonus: Full House pays 25 to 1.','six_card_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is Four of a Kind. Calculate the payout.',NULL,'50','6 Card Bonus: Four of a Kind pays 50 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes Four of a Kind from their six cards. What is the correct payout?',NULL,'50','6 Card Bonus: Four of a Kind pays 50 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with Four of a Kind. Calculate the payout on the bonus wager shown.',NULL,'50','6 Card Bonus: Four of a Kind pays 50 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on Four of a Kind. What do you pay on the wager shown?',NULL,'50','6 Card Bonus: Four of a Kind pays 50 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus hits Four of a Kind. Calculate the correct payout on the wager shown.',NULL,'50','6 Card Bonus: Four of a Kind pays 50 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is a Straight Flush. Calculate the payout.',NULL,'200','6 Card Bonus: Straight Flush pays 200 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes a Straight Flush from their six cards. What is the correct payout?',NULL,'200','6 Card Bonus: Straight Flush pays 200 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with a Straight Flush. Calculate the payout on the bonus wager shown.',NULL,'200','6 Card Bonus: Straight Flush pays 200 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on a Straight Flush. What do you pay on the wager shown?',NULL,'200','6 Card Bonus: Straight Flush pays 200 to 1.','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','On the 6 Card Bonus, the player''s best five-card hand is a Royal Flush. Calculate the payout.',NULL,'1000','6 Card Bonus: Royal Flush pays 1000 to 1 (the top hand).','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus: the player makes a Royal Flush from their six cards. What is the correct payout?',NULL,'1000','6 Card Bonus: Royal Flush pays 1000 to 1 (the top hand).','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the 6 Card Bonus with a Royal Flush. Calculate the payout on the bonus wager shown.',NULL,'1000','6 Card Bonus: Royal Flush pays 1000 to 1 (the top hand).','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The 6 Card Bonus pays on a Royal Flush. What do you pay on the wager shown?',NULL,'1000','6 Card Bonus: Royal Flush pays 1000 to 1 (the top hand).','six_card_bonus',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','6 Card Bonus hits the top hand, a Royal Flush. Calculate the correct payout on the wager shown.',NULL,'1000','6 Card Bonus: Royal Flush pays 1000 to 1 (the top hand).','six_card_bonus',FALSE,3,10,TRUE);


-- THREE CARD POKER — PAIR PLUS  (18 additional payout questions)
-- Pay table: Mini Royal 200:1 | Straight Flush 40:1 | Three of a Kind 30:1
--            Straight 6:1 | Flush 3:1 | Pair 1:1
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player''s Pair Plus wager wins with a Pair (two matching cards). Calculate the payout.',NULL,'1','Pair Plus: a Pair pays 1 to 1 (even money).','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus: the three-card hand contains one Pair. What is the correct payout on the wager shown?',NULL,'1','Pair Plus: a Pair pays 1 to 1 (even money).','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Pair Plus bet wins on a Pair. What do you pay on the wager shown?',NULL,'1','Pair Plus: a Pair pays 1 to 1 (even money).','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player''s Pair Plus wager wins with a Flush (three cards of one suit). Calculate the payout.',NULL,'3','Pair Plus: a Flush pays 3 to 1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus: the three-card hand is a Flush. What is the correct payout on the wager shown?',NULL,'3','Pair Plus: a Flush pays 3 to 1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Pair Plus bet wins on a Flush. What do you pay on the wager shown?',NULL,'3','Pair Plus: a Flush pays 3 to 1.','three_card_poker',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player''s Pair Plus wager wins with a Straight (three cards in sequence). Calculate the payout.',NULL,'6','Pair Plus: a Straight pays 6 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus: the three-card hand is a Straight. What is the correct payout on the wager shown?',NULL,'6','Pair Plus: a Straight pays 6 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Pair Plus bet wins on a Straight. What do you pay on the wager shown?',NULL,'6','Pair Plus: a Straight pays 6 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player''s Pair Plus wager wins with Three of a Kind. Calculate the payout.',NULL,'30','Pair Plus: Three of a Kind pays 30 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus: the three-card hand is Three of a Kind. What is the correct payout on the wager shown?',NULL,'30','Pair Plus: Three of a Kind pays 30 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Pair Plus bet wins on Three of a Kind. What do you pay on the wager shown?',NULL,'30','Pair Plus: Three of a Kind pays 30 to 1.','three_card_poker',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player''s Pair Plus wager wins with a Straight Flush. Calculate the payout.',NULL,'40','Pair Plus: a Straight Flush pays 40 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus: the three-card hand is a Straight Flush. What is the correct payout on the wager shown?',NULL,'40','Pair Plus: a Straight Flush pays 40 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Pair Plus bet wins on a Straight Flush. What do you pay on the wager shown?',NULL,'40','Pair Plus: a Straight Flush pays 40 to 1.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player''s Pair Plus wager wins with a Mini Royal (A-K-Q suited). Calculate the payout.',NULL,'200','Pair Plus: a Mini Royal (A-K-Q suited) pays 200 to 1, the top Pair Plus hand.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Pair Plus: the three-card hand is a Mini Royal (A-K-Q of one suit). What is the correct payout?',NULL,'200','Pair Plus: a Mini Royal (A-K-Q suited) pays 200 to 1, the top Pair Plus hand.','three_card_poker',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Pair Plus bet wins on a Mini Royal. What do you pay on the wager shown?',NULL,'200','Pair Plus: a Mini Royal (A-K-Q suited) pays 200 to 1, the top Pair Plus hand.','three_card_poker',FALSE,3,10,TRUE);


-- THREE CARD POKER — ANTE BONUS  (12 additional payout questions)
-- Pay table: Straight Flush 5:1 | Three of a Kind 4:1 | Straight 1:1
-- Paid on a straight or better, regardless of whether the dealer qualifies
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The player''s final hand is a Straight, qualifying for the Ante Bonus. Calculate the payout.',NULL,'1','Ante Bonus: a Straight pays 1 to 1. The Ante Bonus is paid on a straight or better, even if the dealer does not qualify.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus: a Straight qualifies. What is the correct payout on the Ante wager shown?',NULL,'1','Ante Bonus: a Straight pays 1 to 1. The Ante Bonus is paid on a straight or better, even if the dealer does not qualify.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the Ante Bonus with a Straight. What do you pay on the Ante wager shown?',NULL,'1','Ante Bonus: a Straight pays 1 to 1. The Ante Bonus is paid on a straight or better, even if the dealer does not qualify.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The Ante Bonus pays on a Straight (paid even if the dealer does not qualify). Calculate the payout.',NULL,'1','Ante Bonus: a Straight pays 1 to 1. The Ante Bonus is paid on a straight or better, even if the dealer does not qualify.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus hits on a Straight. Calculate the correct payout on the Ante wager shown.',NULL,'1','Ante Bonus: a Straight pays 1 to 1. The Ante Bonus is paid on a straight or better, even if the dealer does not qualify.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The player''s hand is a Straight; the Ante Bonus applies. What is the payout on the Ante wager?',NULL,'1','Ante Bonus: a Straight pays 1 to 1. The Ante Bonus is paid on a straight or better, even if the dealer does not qualify.','ante_bonus',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The player''s final hand is Three of a Kind, qualifying for the Ante Bonus. Calculate the payout.',NULL,'4','Ante Bonus: Three of a Kind pays 4 to 1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus: Three of a Kind qualifies. What is the correct payout on the Ante wager shown?',NULL,'4','Ante Bonus: Three of a Kind pays 4 to 1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the Ante Bonus with Three of a Kind. What do you pay on the Ante wager shown?',NULL,'4','Ante Bonus: Three of a Kind pays 4 to 1.','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','The player''s final hand is a Straight Flush, qualifying for the Ante Bonus. Calculate the payout.',NULL,'5','Ante Bonus: a Straight Flush pays 5 to 1 (the top Ante Bonus hand).','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','Ante Bonus: a Straight Flush qualifies. What is the correct payout on the Ante wager shown?',NULL,'5','Ante Bonus: a Straight Flush pays 5 to 1 (the top Ante Bonus hand).','ante_bonus',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Three Card Poker'),'payout','A player wins the Ante Bonus with a Straight Flush. What do you pay on the Ante wager shown?',NULL,'5','Ante Bonus: a Straight Flush pays 5 to 1 (the top Ante Bonus hand).','ante_bonus',FALSE,2,10,TRUE);


-- ============================================================
-- Verify counts
--   SELECT category, difficulty, COUNT(*) FROM public.questions
--   WHERE category IN ('six_card_bonus','ante_bonus','three_card_poker')
--   GROUP BY category, difficulty ORDER BY category, difficulty;
-- ============================================================
