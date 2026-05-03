-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Basic Strategy Question Pool — Blackjack
--
-- Run this in the Supabase SQL Editor AFTER seed_questions.sql.
--
-- HOUSE RULES ASSUMED
-- ───────────────────
--   • Multi-deck shoe
--   • Dealer HITS soft 17 (H17)
--   • Double After Split (DAS) ALLOWED
--
-- All questions are multiple choice. Options are stored as a
-- JSON array; correct_answer must EXACTLY match one option string.
-- ============================================================

INSERT INTO public.questions
  (game_id, type, question_text, options, correct_answer, explanation, category, is_procedure, difficulty, points, is_active)
VALUES

-- ─── Hard Totals ─────────────────────────────────────────────
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 12, dealer shows 4. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Stand',
 'Dealer 4 is a bust card (~40%). Let them break.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 12, dealer shows 2. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Dealer 2 only busts ~35%. Most-misplayed hand on the chart.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 13, dealer shows 6. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Stand',
 'Dealer 6 has the highest bust rate (~42%). Let them draw.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 16, dealer shows 10. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Both plays lose — hitting loses slightly less than standing.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 17, dealer shows Ace. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Stand',
 'Only 4 of 13 cards keep you alive on a hit. Stand and hope.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Per the Hitting Hard Hands rule, when the dealer shows 7 through Ace, the player should hit until what total?',
 '["Until 12","Until 15","Until 17","Until 18"]','Until 17',
 'Strong dealer cards rarely bust (~17–26%). You must build a hand.',
 'basic_strategy',FALSE,2,10,TRUE),

-- ─── Hard Doubling ───────────────────────────────────────────
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 8, dealer shows 5. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 '8 is too low to double — most likely makes 18, not strong enough.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 9, dealer shows 2. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Dealer 2 isn''t weak enough to justify doubling on a 9 (multi-deck).',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 9, dealer shows 6. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Dealer''s worst card + likely 19 for you = max profit.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 10, dealer shows 10. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Doubling locks in one card vs. dealer''s likely 20 — too risky.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has hard 11, dealer shows Ace. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Under H17 (dealer hits soft 17), 11 doubles vs every dealer card including Ace.',
 'basic_strategy',FALSE,2,10,TRUE),

-- ─── Soft Totals ─────────────────────────────────────────────
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/2 (soft 13), dealer shows 5. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Can''t bust on one card + dealer weak = max bet opportunity.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/2 (soft 13), dealer shows 4. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Soft 13 is too weak to double; multi-deck only doubles soft 13 vs 5–6.',
 'basic_strategy',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/6 (soft 17), dealer shows 3. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Soft 17 needs improvement; dealer 3 weak enough to justify doubling.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/7 (soft 18), dealer shows 2. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Under H17, soft 18 doubles vs 2 — dealer''s extra bust chance on soft 17 makes this profitable.',
 'basic_strategy',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/7 (soft 18), dealer shows 9. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Dealer''s likely 19 beats your 18 — must improve.',
 'basic_strategy',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/8 (soft 19), dealer shows 6. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Under H17, soft 19 doubles vs 6 — the only soft 19 double on the chart.',
 'basic_strategy',FALSE,1,10,TRUE),

-- ─── Pair Splits ─────────────────────────────────────────────
((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has A/A, dealer shows 10. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Split',
 'One soft 12 → two 11s. Always split, no exception.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 8/8, dealer shows Ace. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Split',
 '16 is the worst hand. Damage control, not a profit play.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 10/10, dealer shows 6. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Stand',
 '20 wins ~85% outright. Never break a winning hand.',
 'basic_strategy',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 5/5, dealer shows 8. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Double',
 'Treat as hard 10 — splitting fives is one of the worst plays possible.',
 'basic_strategy',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 5/5, dealer shows 10. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Hard 10 doesn''t double vs. dealer''s likely 20.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 4/4, dealer shows 5. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Split',
 'With DAS allowed, 4/4 splits vs 5–6 — each new 4 can double on a strong card.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 6/6, dealer shows 7. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Dealer likely makes 17 — splitting just doubles exposure.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 9/9, dealer shows 7. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Stand',
 'Your 18 beats dealer''s likely 17. Don''t break a winner.',
 'basic_strategy',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 9/9, dealer shows Ace. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Split',
 'Under H17, split 9s vs Ace — dealer''s soft-17 hit gives you the edge on both hands.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 7/7, dealer shows 8. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Dealer''s likely 18 beats two new hands starting at 7.',
 'basic_strategy',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Blackjack'),'multiple_choice',
 'Player has 2/2, dealer shows 8. What is the correct play?',
 '["Hit","Stand","Double","Split"]','Hit',
 'Dealer too strong — play hard 4 as a free hit.',
 'basic_strategy',FALSE,2,10,TRUE);
