-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Craps + Caribbean Stud Poker — Games & Question Pool
--
-- Run this in the Supabase SQL Editor AFTER schema.sql
-- (and after seed_questions.sql). Safe to re-run: the game
-- inserts are guarded with NOT EXISTS, and each question block
-- is scoped to its game.
--
-- SOURCE MANUALS
--   • Craps dealer procedures            (Updated 06-10-2020)
--   • Caribbean Stud Poker procedures     (Updated 06-09-2020)
--
-- QUESTION TYPES
--   type = 'payout'          → correct_answer holds the PAYOUT RATIO
--                              as a decimal string ('2' = 2:1, '1.5'
--                              = 3:2). The drill shows a random chip
--                              stack; validation: bet × ratio (±2¢).
--   type = 'multiple_choice' → correct_answer EXACTLY matches one of
--                              the strings in options. Used for the
--                              unit-math bets that don't divide evenly
--                              (place / buy), odds identification,
--                              progressive jackpots, and game-protection
--                              / surveillance procedure scenarios.
--
-- A payout_drill game may hold both question types — the UI renders
-- by question.type, not by the game's drill_type.
-- ============================================================

-- ─── Schema patch: add created_at if absent (matches seed_questions.sql) ─────
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── Schema patch: practice_only flag on games ───────────────
-- practice_only = TRUE  → game appears in Practice mode but is
-- excluded from scored Drill sessions. Flip to FALSE when the
-- team is ready to have the game count toward scored drills.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS practice_only BOOLEAN NOT NULL DEFAULT FALSE;


-- ============================================================
-- GAMES  (idempotent — only insert if not already present)
-- ============================================================

-- Craps starts practice-only. To promote it to scored Drills later, run:
--   UPDATE public.games SET practice_only = FALSE WHERE name = 'Craps';
INSERT INTO public.games (name, drill_type, is_active, practice_only)
SELECT 'Craps', 'payout_drill', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE name = 'Craps');

-- Keep Craps practice-only even if the row already existed from an earlier run.
UPDATE public.games SET practice_only = TRUE WHERE name = 'Craps';

INSERT INTO public.games (name, drill_type, is_active, practice_only)
SELECT 'Caribbean Stud Poker', 'payout_drill', TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE name = 'Caribbean Stud Poker');


-- ============================================================
-- ============================================================
-- CARIBBEAN STUD POKER
-- ============================================================
-- ============================================================

-- ─── Bet payouts (the raise / "call" wager) — type 'payout' ──
-- The Bet pays a bonus based on the player's hand, up to the
-- $1,000 table maximum. Category 'csp_bet' highlights the BET spot.

-- Pair  1:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The dealer qualifies and the player beats the dealer with a Pair. Calculate the payout on the player''s Bet.',NULL,'1','A Pair on the Bet pays 1 to 1 (even money) in Caribbean Stud Poker.','csp_bet',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player wins with a single Pair. What does the Bet pay?',NULL,'1','A Pair pays even money (1:1) on the Bet.','csp_bet',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A qualifying hand beats the dealer with one Pair. Calculate the Bet payout.',NULL,'1','One Pair pays 1 to 1 on the Bet.','csp_bet',FALSE,1,10,TRUE);

-- Two Pair  2:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with Two Pair. Calculate the payout on the Bet.',NULL,'2','Two Pair pays 2 to 1 on the Bet.','csp_bet',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning hand of Two Pair on the Bet — what is the payout?',NULL,'2','Two Pair pays 2 to 1 (up to the table maximum).','csp_bet',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The player''s Bet wins with Two Pair. Calculate the correct payout.',NULL,'2','Two Pair pays 2:1 on the Bet.','csp_bet',FALSE,2,10,TRUE);

-- Three of a Kind  3:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with Three of a Kind. Calculate the Bet payout.',NULL,'3','Three of a Kind pays 3 to 1 on the Bet.','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Three of a Kind on the Bet — what is owed?',NULL,'3','Three of a Kind pays 3:1 (up to the table maximum).','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The Bet wins with trips (Three of a Kind). Calculate the payout.',NULL,'3','Three of a Kind pays 3 to 1 on the Bet.','csp_bet',FALSE,2,10,TRUE);

-- Straight  4:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with a Straight. Calculate the Bet payout.',NULL,'4','A Straight pays 4 to 1 on the Bet.','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Straight on the Bet — what is the payout?',NULL,'4','A Straight pays 4:1 (up to the table maximum).','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The player''s Bet wins with a Straight. Calculate the correct payout.',NULL,'4','A Straight pays 4 to 1 on the Bet.','csp_bet',FALSE,2,10,TRUE);

-- Flush  5:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with a Flush. Calculate the Bet payout.',NULL,'5','A Flush pays 5 to 1 on the Bet.','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Flush on the Bet — what is owed?',NULL,'5','A Flush pays 5:1 (up to the table maximum).','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The Bet wins with a Flush. Calculate the payout.',NULL,'5','A Flush pays 5 to 1 on the Bet.','csp_bet',FALSE,3,10,TRUE);

-- Full House  7:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with a Full House. Calculate the Bet payout.',NULL,'7','A Full House pays 7 to 1 on the Bet.','csp_bet',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Full House on the Bet — what is the payout?',NULL,'7','A Full House pays 7:1 (up to the table maximum).','csp_bet',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The player''s Bet wins with a Full House. Calculate the correct payout.',NULL,'7','A Full House pays 7 to 1 on the Bet.','csp_bet',FALSE,3,10,TRUE);

-- Four of a Kind  20:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with Four of a Kind. Calculate the Bet payout.',NULL,'20','Four of a Kind pays 20 to 1 on the Bet.','csp_bet',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Four of a Kind on the Bet — what is owed (up to table max)?',NULL,'20','Four of a Kind pays 20:1, capped at the $1,000 table maximum.','csp_bet',FALSE,3,10,TRUE);

-- Straight Flush  50:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with a Straight Flush. Calculate the Bet payout.',NULL,'50','A Straight Flush pays 50 to 1 on the Bet.','csp_bet',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Straight Flush on the Bet — what is the table payout (before the cap)?',NULL,'50','A Straight Flush pays 50:1, up to the $1,000 table maximum.','csp_bet',FALSE,3,10,TRUE);

-- Royal Flush  100:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','Player beats the dealer with a Royal Flush. Calculate the Bet payout (before the table cap).',NULL,'100','A Royal Flush pays 100 to 1 on the Bet, up to the $1,000 table maximum.','csp_bet',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Royal Flush on the Bet — what is the table payout rate?',NULL,'100','A Royal Flush pays 100:1 on the Bet (capped at the table maximum).','csp_bet',FALSE,3,10,TRUE);

-- Ante  1:1  (difficulty 1) — category 'csp_ante' highlights the ANTE spot
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The dealer qualifies and the player wins the hand. Calculate the payout on the Ante.',NULL,'1','When the player beats a qualifying dealer, the Ante always pays even money (1:1).','csp_ante',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','The dealer does NOT qualify (no Ace/King or better). Calculate the payout on the Ante.',NULL,'1','If the dealer does not qualify, the Ante is paid even money (1:1) and the Bet is returned as no action.','csp_ante',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'payout','A winning Ante wager in Caribbean Stud Poker — what is the payout?',NULL,'1','The Ante pays 1 to 1.','csp_ante',FALSE,1,10,TRUE);

-- ─── Progressive jackpot payoffs — type 'multiple_choice' ───
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','On the $1 progressive bet, what does a Royal Flush pay?','["100% of the progressive jackpot","10% of the progressive jackpot","$500 flat","$100 flat"]','100% of the progressive jackpot','A Royal Flush wins 100% of the posted progressive jackpot.','csp_progressive',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','On the progressive bet, what does a Straight Flush pay?','["10% of the progressive jackpot","100% of the progressive jackpot","$500 flat","$50 flat"]','10% of the progressive jackpot','A Straight Flush wins 10% of the progressive jackpot.','csp_progressive',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','On the progressive bet, what does Four of a Kind pay?','["$500","$100","$50","10% of the jackpot"]','$500','Four of a Kind pays a flat $500 on the progressive.','csp_progressive',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','On the progressive bet, what does a Full House pay?','["$100","$500","$50","$25"]','$100','A Full House pays a flat $100 on the progressive.','csp_progressive',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','On the progressive bet, what does a Flush pay?','["$50","$100","$25","$500"]','$50','A Flush pays a flat $50 on the progressive.','csp_progressive',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','On the progressive bet, what does a Straight pay?','["$25","$50","$100","10% of the jackpot"]','$25','A Straight pays a flat $25 on the progressive.','csp_progressive',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','When two or more players qualify for the progressive jackpot on the same deal, in what order are they paid?','["Lowest-value hands first, progressing to the highest","Highest-value hands first","The player closest to the dealer first","All at once, splitting the jackpot equally"]','Lowest-value hands first, progressing to the highest','Qualifying hands are paid the lesser jackpot amounts first, progressing to the highest value.','csp_progressive',FALSE,3,10,TRUE);

-- ─── Rules, qualifying & game-protection — type 'multiple_choice' ───
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','What is the minimum hand the dealer must have to qualify (open)?','["Ace/King or higher","A Pair or higher","Any face card","Ace-high only"]','Ace/King or higher','The dealer must have at least Ace/King or higher to qualify. Otherwise only the Ante is paid.','csp_procedure',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','The dealer does not qualify. How is the hand settled?','["Pay even money on the Ante only; the Bet is returned as no action","Pay both the Ante and the Bet in full","Take the Ante and return the Bet","Push everything"]','Pay even money on the Ante only; the Bet is returned as no action','If the dealer does not have Ace/King or better, only the Ante is paid (even money) and the Bet is returned.','csp_procedure',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','If a player wishes to stay in and call the dealer, how much must the Bet be?','["Exactly twice the Ante","Equal to the Ante","Any amount up to the table maximum","Half the Ante"]','Exactly twice the Ante','To call the dealer, the player makes an additional Bet of exactly twice the amount of the Ante.','csp_procedure',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','How does the dealer deal the cards?','["Five cards face down to each player and the dealer, with the dealer''s last card face up","All cards face up","Five cards face up to players, dealer face down","Three cards each"]','Five cards face down to each player and the dealer, with the dealer''s last card face up','Each player and the dealer receive five face-down cards; only the dealer''s last card is turned face up.','csp_procedure',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','A player wins with Four of a Kind or higher. What surveillance step is required before paying?','["Call surveillance to verify no card switching before the payout is made","Pay immediately, then notify surveillance","No surveillance involvement is needed","Send the player to the cage"]','Call surveillance to verify no card switching before the payout is made','On Four of a Kind and up, surveillance must verify (no switching / irregular play) before the payout is approved.','csp_procedure',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','After a Straight Flush or Royal Flush is paid, what happens to the cards?','["The decks are delivered to Surveillance","They are returned to the shuffle machine","They are discarded normally","They stay in play for the next hand"]','The decks are delivered to Surveillance','On a Straight Flush or Royal Flush, the decks are delivered to Surveillance.','csp_procedure',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','A hand between player and dealer ends in a tie on the ranked hands. How is it resolved?','["The next-highest card (3rd, 4th, or 5th) breaks the tie","It is always a push","The dealer wins all ties","The player wins all ties"]','The next-highest card (3rd, 4th, or 5th) breaks the tie','On a tie of equal hands, the 3rd, 4th, or 5th card breaks the tie; an exact tie is a push.','csp_procedure',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','When must the dealer press the "lock-out" button?','["Before dealing, to stop further progressive bets","After paying all winners","Only when a jackpot is hit","At the start of each shift"]','Before dealing, to stop further progressive bets','Before the cards are dealt the dealer presses the lock-out button, restricting any more progressive bets.','csp_procedure',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','What is the maximum table payout on a winning Bet hand?','["$1,000","$500","$250","Unlimited"]','$1,000','All Bet payouts are made up to the table maximum, which is $1,000.','csp_procedure',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','A player who did not bet the progressive makes a Flush that would normally qualify for it. What is paid?','["Only the normal table odds — no progressive","The full progressive jackpot","Half the progressive","The progressive plus the Bet bonus"]','Only the normal table odds — no progressive','If the player is not on the progressive, qualifying hands are paid only the normal table odds, never the progressive.','csp_procedure',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','A player asks the dealer to place a Bet verbally without putting the money up (a "call bet"). What should the dealer do?','["Refuse — call bets are not accepted","Accept it and book it verbally","Accept it only for regulars","Accept it up to the table minimum"]','Refuse — call bets are not accepted','No call bets are accepted; a wager must be accompanied by money on the layout.','csp_procedure',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','A table incurs a win or loss greater than $10,000 in a shift. What is required?','["Surveillance receives all the cards from that table","Nothing — it is a normal fluctuation","The table is closed immediately","The dealer is relieved"]','Surveillance receives all the cards from that table','Surveillance receives all cards from any table that incurs a win or loss greater than $10,000 in a shift.','csp_procedure',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','With which hand does the dealer place cards for spot number 1 and 2?','["The left hand only","The right hand only","Either hand","A dealing shoe"]','The left hand only','The dealer places the cards for spot number 1 and 2 with the left hand only.','csp_procedure',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Caribbean Stud Poker'),'multiple_choice','What is the limit on the Ante bet?','["Up to $250","Up to $500","Up to $1,000","Up to $100"]','Up to $250','The limit on the Ante is up to $250; the Bet limit is $500; payouts are up to the $1,000 table maximum.','csp_procedure',FALSE,2,10,TRUE);


-- ============================================================
-- ============================================================
-- CRAPS
-- ============================================================
-- ============================================================

-- ─── Even-money & flat bets — type 'payout' ─────────────────
-- Category 'craps_line' highlights the Pass Line / box area.

-- Pass Line / Come  1:1  (difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Pass Line bet wins on the come-out roll. Calculate the payout on the flat bet.',NULL,'1','Pass Line bets pay even money — 1 to 1.','craps_line',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Come bet wins. Calculate the payout on the flat bet.',NULL,'1','Come bets pay 1 to 1, the same as the Pass Line.','craps_line',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','The point is made and the player''s Pass Line bet wins. What does the flat bet pay?',NULL,'1','Pass Line and Come bets are paid at odds of 1 to 1.','craps_line',FALSE,1,10,TRUE);

-- Don't Pass / Don't Come  1:1  (difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Don''t Pass bet wins (a 7 rolled before the point repeated). Calculate the flat payout.',NULL,'1','A winning Don''t Pass or Don''t Come bet pays 1 to 1.','craps_line',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Don''t Come bet wins. Calculate the payout on the flat bet.',NULL,'1','Don''t Come bets pay even money — 1 to 1.','craps_line',FALSE,2,10,TRUE);

-- ─── Field bets — type 'payout' (category 'craps_field') ────
-- Field wins on 2,3,4,9,10,11,12. The 2 and 12 pay double.
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Field bet wins on a 3, 4, 9, 10, or 11. Calculate the payout.',NULL,'1','On a 3, 4, 9, 10, or 11 the Field pays 1 to 1.','craps_field',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Field bet wins on a 4. Calculate the payout.',NULL,'1','The Field pays even money (1:1) on 3, 4, 9, 10, and 11.','craps_field',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Field bet wins on a 2. Calculate the payout.',NULL,'2','The 2 pays double on the Field — 2 to 1.','craps_field',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Field bet wins on a 12 (boxcars). Calculate the payout.',NULL,'2','The 12 pays double on the Field — 2 to 1.','craps_field',FALSE,2,10,TRUE);

-- ─── Odds & Buy on the 4 / 10  (true odds 2:1) — type 'payout' ─
-- Category 'craps_odds' highlights the point / box area.
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'payout','A player took odds behind the Pass Line on a point of 4. The point is made. Calculate the odds payout.',NULL,'2','Odds on a point of 4 or 10 pay true odds of 2 to 1.','craps_odds',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A player took odds on a point of 10 and it repeats. Calculate the odds payout.',NULL,'2','Odds on the 4 or 10 pay 2 to 1.','craps_odds',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Buy bet on the 4 wins. Before commission, calculate the true-odds payout.',NULL,'2','A Buy bet on the 4 or 10 pays true odds of 2 to 1 (a 5% commission is charged separately).','craps_odds',FALSE,3,10,TRUE);

-- ─── Hardway bets — type 'payout' (category 'craps_hardway') ─
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Hard 4 (2-2) wins. Calculate the payout.',NULL,'7','Hard 4 and Hard 10 pay 7 to 1.','craps_hardway',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Hard 10 (5-5) wins. Calculate the payout.',NULL,'7','Hard 4 and Hard 10 pay 7 to 1.','craps_hardway',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Hard 6 (3-3) wins. Calculate the payout.',NULL,'9','Hard 6 and Hard 8 pay 9 to 1.','craps_hardway',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Hard 8 (4-4) wins. Calculate the payout.',NULL,'9','Hard 6 and Hard 8 pay 9 to 1.','craps_hardway',FALSE,3,10,TRUE);

-- ─── One-roll proposition bets — type 'payout' (category 'craps_prop') ─
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'payout','An Any Seven bet wins. Calculate the payout.',NULL,'4','Any Seven pays 4 to 1.','craps_prop',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','An Any Craps bet wins (2, 3, or 12 rolled). Calculate the payout.',NULL,'7','Any Craps pays 7 to 1.','craps_prop',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','An Eleven (Yo) bet wins. Calculate the payout.',NULL,'15','Eleven (Yo) pays 15 to 1.','craps_prop',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Craps Three (Ace-Deuce) bet wins. Calculate the payout.',NULL,'15','Craps Three (Ace-Deuce) pays 15 to 1.','craps_prop',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Craps Two (Snake Eyes / Aces) bet wins. Calculate the payout.',NULL,'30','Craps Two (Aces) pays 30 to 1.','craps_prop',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'payout','A Craps Twelve (Boxcars) bet wins. Calculate the payout.',NULL,'30','Craps Twelve (Boxcars) pays 30 to 1.','craps_prop',FALSE,3,10,TRUE);

-- ─── Place-bet unit math — type 'multiple_choice' (category 'craps_place') ─
-- These ratios don't divide evenly, so fixed amounts are given.
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A $30 Place bet on the 5 wins (pays 7 to 5). What is the payout?','["$42","$45","$54","$30"]','$42','Place 5 pays 7:5. $30 ÷ 5 = 6, then 6 × 7 = $42.','craps_place',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A $25 Place bet on the 9 wins (pays 7 to 5). What is the payout?','["$35","$45","$25","$30"]','$35','Place 9 pays 7:5. $25 ÷ 5 = 5, then 5 × 7 = $35.','craps_place',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A $18 Place bet on the 6 wins (pays 7 to 6). What is the payout?','["$21","$18","$24","$27"]','$21','Place 6 pays 7:6. $18 ÷ 6 = 3, then 3 × 7 = $21.','craps_place',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A $24 Place bet on the 8 wins (pays 7 to 6). What is the payout?','["$28","$24","$32","$36"]','$28','Place 8 pays 7:6. $24 ÷ 6 = 4, then 4 × 7 = $28.','craps_place',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A $15 Place bet on the 4 wins (pays 9 to 5). What is the payout?','["$27","$15","$25","$30"]','$27','Place 4 pays 9:5. $15 ÷ 5 = 3, then 3 × 9 = $27.','craps_place',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A $50 Place bet on the 10 wins (pays 9 to 5). What is the payout?','["$90","$100","$70","$50"]','$90','Place 10 pays 9:5. $50 ÷ 5 = 10, then 10 × 9 = $90.','craps_place',FALSE,3,10,TRUE);

-- ─── Odds identification & vig — type 'multiple_choice' (category 'craps_odds') ─
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','What are the true odds paid on a Pass Line odds bet when the point is 6 or 8?','["6 to 5","3 to 2","2 to 1","7 to 6"]','6 to 5','Odds on a point of 6 or 8 pay 6 to 5.','craps_odds',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','What are the true odds paid on a Pass Line odds bet when the point is 5 or 9?','["3 to 2","6 to 5","2 to 1","7 to 5"]','3 to 2','Odds on a point of 5 or 9 pay 3 to 2.','craps_odds',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','What are the true odds paid on a Pass Line odds bet when the point is 4 or 10?','["2 to 1","3 to 2","6 to 5","9 to 5"]','2 to 1','Odds on a point of 4 or 10 pay 2 to 1.','craps_odds',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','What is the minimum wager and commission on a Buy bet?','["A minimum of $20, with a 5% commission (vig)","A minimum of $5, with no commission","A minimum of $100, with a 10% commission","Any amount, with a flat $5 fee"]','A minimum of $20, with a 5% commission (vig)','Buy bets must be a minimum of $20 and pay true odds after a 5% commission (vig), rounded down to the whole dollar.','craps_odds',FALSE,3,10,TRUE);

-- ─── Game protection & surveillance procedure — type 'multiple_choice' ─
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','One or both dice go off the table. What must happen before they are used again?','["The Box man must check them before further use","The stickman returns them to play immediately","The shooter inspects them","Nothing — play continues"]','The Box man must check them before further use','Any dice that leave the table (or the stickman''s clear sight) must be checked by the Box man before further use.','craps_protection',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','Which areas of the layout are the most vulnerable to past-posting and pressing?','["The Don''t Come and Don''t Pass lines","The Field","The center proposition box","The Pass Line only"]','The Don''t Come and Don''t Pass lines','The Don''t Come and Don''t Pass lines are the most vulnerable points on the layout for past-posters and pressers.','craps_protection',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A shooter slides the dice instead of rolling them, so both dice do not leave the hand and tumble. What is the call?','["No roll","Dice — call the total","Seven out","Craps"]','No roll','A slid throw, or one where both dice do not leave the shooter''s hand and tumble, is called "no roll".','craps_protection',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','What must a player have in order to qualify to shoot the dice?','["Either a Pass Line or Don''t Pass bet","Any proposition bet","A Field bet","No bet is required"]','Either a Pass Line or Don''t Pass bet','To qualify to shoot, a player must have either a Pass Line or a Don''t Pass bet.','craps_protection',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','A die comes to rest cocked (leaning against chips) with no flat side. How is it called?','["By the high or uppermost side of the die","Always as no roll","By the lowest side","The shooter re-rolls only that die"]','By the high or uppermost side of the die','A cocked die is called according to its high or uppermost side; the total is called before the dice are moved.','craps_protection',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','Following the dice with your eyes to the far side of the table when you should be watching your own end is called what — and is it allowed?','["Hawking — it is strictly prohibited","Casing — it is required","Squaring — it is encouraged","Booking — it is allowed"]','Hawking — it is strictly prohibited','"Hawking" the dice — following them to the opposite end instead of watching your own area — is strictly prohibited.','craps_protection',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','When dealing to any bet of $100 or more, what must the Dealer call out?','["\"Checks play\"","\"No more bets\"","\"Coming out\"","\"Same dice\""]','"Checks play"','On any bet of $100 or more the Dealer must call out "checks play" so the table manager is aware of the action.','craps_protection',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','After every roll, what does the stickman do with the dice so the Boxman can inspect them?','["Bring them to the center and square them off so the opposite sides show in the mirror","Drop them straight into the bowl","Hand them to the shooter","Cover them with the stick"]','Bring them to the center and square them off so the opposite sides show in the mirror','After every roll the dice are brought to the center and squared off so the Boxman can see the opposite sides in the mirror.','craps_protection',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','May a Dealer accept currency or chips directly from a player''s hand?','["No — the player must set them down on the layout in public view","Yes, for any transaction","Only for amounts under $100","Only tips"]','No — the player must set them down on the layout in public view','Never take or place anything directly from a player''s hand; items must be set down on the layout in public view (the only exception is a die retrieved from off the game).','craps_protection',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','How many dice are kept at the Craps table, and who controls them?','["Five dice, controlled by the stickman","Two dice, controlled by the shooter","Three dice, controlled by the Boxman","Five dice, controlled by the base dealers"]','Five dice, controlled by the stickman','A set of five dice is kept at the table; control of the dice — in play and in the bowl — is the stickman''s responsibility.','craps_protection',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','Are verbal "call bets" (a wager with no money down) accepted in Craps?','["No — absolutely no call bets are accepted","Yes, from any player","Yes, for known players only","Yes, up to the table minimum"]','No — absolutely no call bets are accepted','Absolutely no call bets will be accepted — a wager must be accompanied by money on the layout.','craps_protection',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Craps'),'multiple_choice','On a decision roll of a 7 with a point established ("seven out"), what happens to Pass Line bets and the odds behind them?','["The line bets lose and the odds are taken with them","They push","They win even money","Only the flat bet loses; odds are returned"]','The line bets lose and the odds are taken with them','On a seven-out the front line loses; the Pass Line flat bets and the odds behind them are taken to the bankroll (the Don''t Pass is paid).','craps_protection',FALSE,3,10,TRUE);
