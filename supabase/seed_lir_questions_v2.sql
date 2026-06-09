-- ============================================================
-- LET IT RIDE — 90 Additional Questions (v2)
-- 20 easy + 30 medium + 20 hard (multiple_choice)
-- 20 payout drills (extends existing 30 in seed_questions.sql)
--
-- Run AFTER seed_questions.sql in the Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- EASY (20)   difficulty 1   type: multiple_choice
-- ============================================================

INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the lowest-ranking hand that pays out in Let It Ride?',
 '["Pair of Tens or better","Any pair","Pair of Nines or better","Two Pair"]',
 'Pair of Tens or better',
 'The lowest paying hand is a pair of Tens. A pair of Nines or lower is a losing hand.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How many cards is each player dealt in Let It Ride?',
 '["Three","Two","Four","Five"]',
 'Three',
 'Each player receives three cards face down, which combine with two community cards to form a five-card hand.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How many community cards are used in Let It Ride?',
 '["Two","One","Three","Four"]',
 'Two',
 'The dealer places two community cards face down. Both are shared by all players.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What are the three Let It Ride betting spots labeled?',
 '["(1), (2), and ($)","A, B, and C","Pass, Place, and Win","Red, Blue, and Gold"]',
 '(1), (2), and ($)',
 'Spots (1) and (2) can be withdrawn at the right times; the ($) spot cannot.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How much does the progressive jackpot side bet cost?',
 '["$1","$5","$2","$0.50"]',
 '$1',
 'The progressive jackpot bet is $1, placed on the red circle in front of the betting circle.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the table minimum bet per spot in Let It Ride?',
 '["$5","$1","$10","$25"]',
 '$5',
 'The minimum bet per spot is $5.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the table maximum bet per spot in Let It Ride?',
 '["$250","$100","$500","$200"]',
 '$250',
 'The maximum bet per spot is $250.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Which betting spot can a player NEVER withdraw in Let It Ride?',
 '["The ($) spot","Spot (1)","Spot (2)","The progressive spot"]',
 'The ($) spot',
 'The ($) spot is the one-third of the wager that can never be taken back.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How many chances does a player get to take back part of their bet?',
 '["Twice","Once","Three times","Never"]',
 'Twice',
 'Players get two chances: before the first community card, and after the first but before the second.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What does it mean when a player "lets it ride"?',
 '["They choose not to withdraw their bet","They want new cards","They double their bet","They fold"]',
 'They choose not to withdraw their bet',
 'When a player does not withdraw their bet, they are said to "let it ride."',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for a Pair of Tens, Jacks, Queens, Kings, or Aces?',
 '["1 to 1 (even money)","2 to 1","3 to 1","Push"]',
 '1 to 1 (even money)',
 'Any pair of Tens or better pays 1 to 1.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for Two Pair in Let It Ride?',
 '["2 to 1","1 to 1","3 to 1","5 to 1"]',
 '2 to 1',
 'Two Pair pays 2 to 1 on each active bet.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for Three of a Kind in Let It Ride?',
 '["3 to 1","2 to 1","5 to 1","8 to 1"]',
 '3 to 1',
 'Three of a Kind pays 3 to 1.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for a Straight in Let It Ride?',
 '["5 to 1","3 to 1","8 to 1","11 to 1"]',
 '5 to 1',
 'A Straight pays 5 to 1.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for a Flush in Let It Ride?',
 '["8 to 1","5 to 1","11 to 1","3 to 1"]',
 '8 to 1',
 'A Flush pays 8 to 1.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What button does the dealer press before dealing to stop players from placing more progressive bets?',
 '["The lockout button","The reset button","The deal button","The confirm button"]',
 'The lockout button',
 'Before dealing, the dealer presses the lockout button to restrict further progressive betting.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What button does the dealer press after each hand to re-open progressive betting?',
 '["The reset button","The lockout button","The start button","The clear button"]',
 'The reset button',
 'At the end of each hand, the dealer presses the reset button so players can place their $1 bet for the next round.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Can a player use cash (paper bills) to play at the Let It Ride table?',
 '["No — money does not play under any circumstances","Yes, for amounts under $100","Yes, with manager approval","Yes, on the first bet only"]',
 'No — money does not play under any circumstances',
 'Cash does not play under any circumstances. All bets must be placed with gaming chips.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Where does the dealer place each player''s three cards?',
 '["Face down behind the betting spot","Face up in front of the player","Face up in the center of the table","Face down at the center of the table"]',
 'Face down behind the betting spot',
 'Cards are placed face down behind the betting spot, spread so all three are visible to the player.',
 'let_it_ride',FALSE,1,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'At Stellaris Casino, which games share a progressive jackpot with Let It Ride?',
 '["Caribbean Stud and Texas Hold''em Bonus","Blackjack and Roulette","Three Card Poker and Baccarat","Ultimate Texas Hold''em and Craps"]',
 'Caribbean Stud and Texas Hold''em Bonus',
 'The Let It Ride progressive jackpot at Stellaris is linked with Caribbean Stud Poker and Texas Hold''em Bonus Poker.',
 'let_it_ride',FALSE,1,10,TRUE);


-- ============================================================
-- MEDIUM (30)   difficulty 2   type: multiple_choice
-- ============================================================

-- Payout table — higher hands (5 questions)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for a Full House in Let It Ride?',
 '["11 to 1","8 to 1","15 to 1","50 to 1"]',
 '11 to 1',
 'A Full House pays 11 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for Four of a Kind in Let It Ride?',
 '["50 to 1","25 to 1","30 to 1","100 to 1"]',
 '50 to 1',
 'Four of a Kind pays 50 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for a Straight Flush in Let It Ride?',
 '["200 to 1","100 to 1","500 to 1","1000 to 1"]',
 '200 to 1',
 'A Straight Flush pays 200 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the payout for a Royal Flush in Let It Ride?',
 '["1000 to 1","500 to 1","2000 to 1","200 to 1"]',
 '1000 to 1',
 'A Royal Flush pays 1000 to 1, subject to the $25,000 maximum payout limit.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the maximum payout per hand on the Let It Ride bet wagers?',
 '["$25,000","$10,000","$50,000","$100,000"]',
 '$25,000',
 'There is a maximum payout limit of $25,000 per hand.',
 'let_it_ride',FALSE,2,10,TRUE);

-- Dealing sequence (5 questions)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Starting where and in which direction does the dealer ask each player about Bet (1)?',
 '["Player farthest to the dealer''s left, moving clockwise","Dealer''s right, clockwise","Center, moving outward","Randomly"]',
 'Player farthest to the dealer''s left, moving clockwise',
 'Both bet decisions go from the player farthest to the dealer''s left, moving clockwise.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'After the second community card is revealed, in which direction does the dealer settle hands?',
 '["Right to left (counterclockwise)","Left to right (clockwise)","Center outward","Randomly"]',
 'Right to left (counterclockwise)',
 'After the second community card, the dealer settles hands starting from the player farthest to the dealer''s right, moving counterclockwise.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What happens to the bottom card of the three community cards dealt?',
 '["It is burned and placed in the discard rack","It becomes the first community card","It is turned face up for all players","It is given to the player on the left"]',
 'It is burned and placed in the discard rack',
 'Three cards are dealt for the community area. The bottom card is burned and placed in the discard rack, leaving two face-down community cards.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Which community card is turned face up first?',
 '["The card to the dealer''s left","The card to the dealer''s right","The center card","The dealer decides"]',
 'The card to the dealer''s left',
 'The community card to the dealer''s left is revealed first and becomes the first community card.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'When must a dealer call out "checks play"?',
 '["Any time a bet of $100 or more is being dealt","Only on bets over $500","Only when requested by a manager","Only at the start of a new shoe"]',
 'Any time a bet of $100 or more is being dealt',
 'When dealing to any bet of $100 or more, the dealer must call out "checks play" so the table manager is aware.',
 'let_it_ride',FALSE,2,10,TRUE);

-- 3 Card Bonus payouts (5 questions)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the 3 Card Bonus payout for a Pair?',
 '["1 to 1","2 to 1","3 to 1","6 to 1"]',
 '1 to 1',
 'A Pair on the 3 Card Bonus pays 1 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the 3 Card Bonus payout for a Flush?',
 '["3 to 1","1 to 1","6 to 1","8 to 1"]',
 '3 to 1',
 'A Flush on the 3 Card Bonus pays 3 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the 3 Card Bonus payout for a Straight?',
 '["6 to 1","3 to 1","10 to 1","15 to 1"]',
 '6 to 1',
 'A Straight on the 3 Card Bonus pays 6 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the 3 Card Bonus payout for Three of a Kind?',
 '["30 to 1","10 to 1","20 to 1","50 to 1"]',
 '30 to 1',
 'Three of a Kind on the 3 Card Bonus pays 30 to 1.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the 3 Card Bonus payout for a Straight Flush?',
 '["40 to 1","30 to 1","50 to 1","100 to 1"]',
 '40 to 1',
 'A Straight Flush on the 3 Card Bonus pays 40 to 1.',
 'let_it_ride',FALSE,2,10,TRUE);

-- Progressive jackpot payouts (6 questions)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the progressive jackpot payout for a Royal Flush?',
 '["100% of the jackpot","50% of the jackpot","$10,000 flat","10% of the jackpot"]',
 '100% of the jackpot',
 'A Royal Flush wins 100% of the current progressive jackpot.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the progressive jackpot payout for a Straight Flush?',
 '["10% of the jackpot","50% of the jackpot","25% of the jackpot","5% of the jackpot"]',
 '10% of the jackpot',
 'A Straight Flush wins 10% of the progressive jackpot.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the fixed progressive jackpot payout for Four of a Kind?',
 '["$500","$250","$1,000","5% of the jackpot"]',
 '$500',
 'Four of a Kind wins a fixed $500 from the progressive jackpot.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the fixed progressive jackpot payout for a Full House?',
 '["$100","$50","$75","$200"]',
 '$100',
 'A Full House wins a fixed $100 from the progressive jackpot.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the fixed progressive jackpot payout for a Flush?',
 '["$50","$25","$100","$75"]',
 '$50',
 'A Flush wins a fixed $50 from the progressive jackpot.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the fixed progressive jackpot payout for a Straight?',
 '["$25","$10","$50","$75"]',
 '$25',
 'A Straight wins a fixed $25 from the progressive jackpot.',
 'let_it_ride',FALSE,2,10,TRUE);

-- Progressive procedures + general rules (7 questions)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'When is the progressive jackpot payout for Four of a Kind or better made?',
 '["After all other players'' hands have been settled","Immediately, before other hands are settled","At the same time as all other hands","Only after the manager inserts the payoff key first"]',
 'After all other players'' hands have been settled',
 'A Four of a Kind or better progressive payout is made after all other players are settled. Surveillance must confirm the hand first.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How many signatures are required on a progressive jackpot payout slip?',
 '["Two managers and the dealer","Dealer only","One manager and the dealer","Security officer and one manager"]',
 'Two managers and the dealer',
 'Two managers sign the payout slip together with the dealer. The dealer verifies all information before dropping it.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Are players allowed to show their cards or look at other players'' cards?',
 '["No — not at any point","Yes, after the first community card is revealed","Yes, if the dealer gives permission","Only at showdown"]',
 'No — not at any point',
 'Players are not permitted to show their cards or see other players'' cards at any point.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'After which winning hands must the cards be replaced with a new deck?',
 '["After a Four of a Kind, Straight Flush, or Royal Flush","Only after a Royal Flush","Any winning hand over $1,000","After any hand paying a progressive jackpot"]',
 'After a Four of a Kind, Straight Flush, or Royal Flush',
 'Cards must be changed after a Four of a Kind, Straight Flush, or Royal Flush.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A player drops one of their cards off the table. What must the dealer do?',
 '["Immediately call a Manager","Pick it up and return it to the player","Continue the game without that player","Void that player''s hand only"]',
 'Immediately call a Manager',
 'If a player drops a card from the table or out of view, call a Manager immediately. A Pit, Operations, or Shift Manager determines the validity of the hand.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the betting range for the 3 Card Bonus side bet?',
 '["$5 to $50","$1 to $25","$5 to $100","$10 to $100"]',
 '$5 to $50',
 'The 3 Card Bonus minimum is $5, maximum $50.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Where does the player place the $1 progressive jackpot bet on the layout?',
 '["On the red circle directly in front of the betting circle","On any one of the three main betting spots","Next to the community card area","On the ($) spot"]',
 'On the red circle directly in front of the betting circle',
 'The $1 progressive jackpot bet is placed on the red circle directly in front of the main betting circle.',
 'let_it_ride',FALSE,2,10,TRUE);

-- Applied calculation questions (2 questions)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A player bets $25 per spot and lets all three spots ride. They win with a Full House. What is their total payout?',
 '["$825","$275","$1,100","$300"]',
 '$825',
 'Total active bet = $75 ($25 × 3 spots). Full House pays 11:1. $75 × 11 = $825.',
 'let_it_ride',FALSE,2,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A player bets $60 per spot and wins a Royal Flush with all three spots active. What is the actual payout they receive?',
 '["$25,000","$180,000","$60,000","$75,000"]',
 '$25,000',
 'At 1000:1 the full payout would be $180,000, but the maximum payout per hand is $25,000.',
 'let_it_ride',FALSE,2,10,TRUE);


-- ============================================================
-- HARD (20)   difficulty 3   type: multiple_choice
-- ============================================================

INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A dealer''s card is found face up during the deal. What is the correct action?',
 '["All hands are voided","Continue the game and ignore it","Void only the player nearest that card","Deal a replacement card to the dealer"]',
 'All hands are voided',
 'If a dealer''s card is found face up, all hands are voided. If more than one card is found face up during the deal, all hands are voided and the cards reshuffled.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A player''s card is found face up in the shuffle machine while cards are being dealt. What is the correct action?',
 '["Continue with the game","Void all hands","Void only that player''s hand","Pause the game and call surveillance"]',
 'Continue with the game',
 'A player''s card found face up in the shuffle machine during the deal — the dealer continues with the game. Only a dealer''s card being exposed requires voiding all hands.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A player is dealt an incorrect number of cards. What must happen?',
 '["All hands are voided and all cards reshuffled","The player draws or discards to reach three cards","Only that player''s hand is voided","The hand continues with manager approval"]',
 'All hands are voided and all cards reshuffled',
 'If any player or the community card area receives an incorrect number of cards, all hands are voided and all cards reshuffled.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'The shuffle machine fails and stops dealing cards mid-round. What is the correct action?',
 '["The round is voided, all wagers returned, and all cards reshuffled","The dealer finishes the deal by hand","Continue with only the cards already dealt","Only complete hands play out; incomplete hands are voided"]',
 'The round is voided, all wagers returned, and all cards reshuffled',
 'If the shuffle machine jams or fails to deal all cards, the round is voided, all wagers are returned, and all cards — including those already dealt — are reshuffled.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'What is the correct sequence when a player requests a marker?',
 '["Dealer informs manager → manager places the lammer → dealer cuts chips after approval → manager processes marker → player signs → dealer signs","Dealer cuts chips, then calls a manager","Player signs the marker first, then chips are issued","Dealer calls surveillance, then issues chips after approval"]',
 'Dealer informs manager → manager places the lammer → dealer cuts chips after approval → manager processes marker → player signs → dealer signs',
 'The lammer must be placed by the manager before any chips are cut. The dealer verifies all marker information (name, game type, table number, amount) before signing.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'In which situations must the dealer clear their hands and show palms?',
 '["When relieved, when touching any body part, when leaving a dead game, and after every transaction","Only when being relieved","Only after cash transactions","Only when handling chips over $500"]',
 'When relieved, when touching any body part, when leaving a dead game, and after every transaction',
 'The dealer claps once showing palms upward and downward: when relieved, when taking hands to any body part, when separating from a dead game, and after every transaction.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'A Let It Ride table has a significant win or loss exceeding $10,000. What must happen to the cards?',
 '["The cards must be sent to surveillance","They are shuffled immediately and play continues","A new deck is automatically brought in","The table is closed for the remainder of the shift"]',
 'The cards must be sent to surveillance',
 'Any table with a significant win or loss of more than $10,000 must have the cards sent to surveillance. The same applies immediately to any Straight Flush or higher.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'When a fill is delivered, what must the dealer do first with the chips?',
 '["Empty the chips from the racks (highest denomination closest to the dealer) and cut down one stack of the highest denomination","Sign the fill slip, then add chips to the rack","Place chips directly into the rack and call the manager","Verify the fill slip before touching the chips"]',
 'Empty the chips from the racks (highest denomination closest to the dealer) and cut down one stack of the highest denomination',
 'The dealer empties the chips — highest denomination closest to the dealer — then cuts down one stack of the highest denomination and sizes it into the remaining stacks before the manager verifies.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'An error is found during a fill verification. What is the correct action?',
 '["The fill and fill slip are returned to the cage for correction; chips are NOT added to the bankroll","Accept the fill and note the error on the slip","Correct it at the table with manager approval","Void the fill and request a new one the next shift"]',
 'The fill and fill slip are returned to the cage for correction; chips are NOT added to the bankroll',
 'If any error is found during fill verification, the fill and fill slip must be returned to the cage for correction. Chips are not added to the bankroll.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Which items must the dealer verify on a fill slip before signing?',
 '["Date, time, pit, game type, table number, amount of each denomination, and fill total","Total dollar amount and manager signature only","Date, total amount, and dealer signature only","Game type, table number, and fill total only"]',
 'Date, time, pit, game type, table number, amount of each denomination, and fill total',
 'All seven items must be confirmed: date, time, pit, game type, table number, amount per denomination, and the fill total.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How long must the yellow copy of the fill slip stay on the table?',
 '["For at least one full round of play","Until the end of the current shift","Until the manager removes it","Until the next fill arrives"]',
 'For at least one full round of play',
 'The yellow copy stays on the table for at least one round of play. After that, only the dealer drops the slip.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Who is the only person authorized to drop the closer slip at table closing?',
 '["The dealer — unless two managers conduct the closing","The table manager","Any licensed casino employee","The security officer"]',
 'The dealer — unless two managers conduct the closing',
 'Only the dealer drops the Closer slip, unless 2 managers conduct the closing process.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'How must a dealer stand on a dead game?',
 '["Parade rest with hands placed on either side of the chip tray","Arms folded, facing the entrance","Leaning against the shuffle machine","Seated on the dealer stool"]',
 'Parade rest with hands placed on either side of the chip tray',
 'On a dead game, dealers stand parade rest with hands on either side of the chip tray. Arms must not be folded, and the dealer must not lean against the table or shuffle machine, nor turn their back to the bankroll.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'During table closing, which denomination chips are removed from the rack first?',
 '["Highest denomination first ($1,000, $500, $100)","Lowest denomination first","In any order, whichever is fastest","One stack from each denomination simultaneously"]',
 'Highest denomination first ($1,000, $500, $100)',
 'The highest denomination chips are always removed first, broken down to verify as twenty, then re-stacked before moving to the next denomination.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'When processing a color change with mixed denomination chips coming in, what is the correct counting order?',
 '["Highest denomination first, counting from closest to the dealer (rack) outward, odd amounts to the side","Smallest denomination first, counting away from the dealer","In the order the player originally stacked them","Highest denomination first, counting from farthest away inward"]',
 'Highest denomination first, counting from closest to the dealer (rack) outward, odd amounts to the side',
 'Start with the highest denomination chips. Count from closest to the dealer (rack) outward. Odd chip amounts go to the side.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'When walking the game during play, which seat positions require the most attention?',
 '["Position 1 and Position 7","All positions equally","Center positions where the most bets are placed","Positions with bets of $100 or more"]',
 'Position 1 and Position 7',
 'While walking the game from the left position to the discard position, the dealer pays special attention to positions 1 and 7.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'At the Let It Ride table, if a player wants to place a toke bet for the dealer, where must that bet be placed first?',
 '["On the ($) spot (contract bet) first","On any of the three betting spots","On the progressive jackpot circle","On spot (1) or (2) only"]',
 'On the ($) spot (contract bet) first',
 'At the LIR game, a player betting for the dealer must place the toke on the ($) spot first. The player may also bet the toke on the 3 Card Bonus.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'After each round of play, what must the dealer verify before collecting any player''s cards?',
 '["That all three cards of each player are present","That all community cards are face down","That all losing bets have been placed in the float","That no cards remain in the shuffle machine"]',
 'That all three cards of each player are present',
 'After each round, the dealer collects all cards individually and must always verify first that all three cards of each player are present.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'Under what condition can a winning toke bet be re-wagered instead of taken down?',
 '["Only if the guest insists AND a table Manager gives permission","Whenever the player asks","Only if the dealer decides it is fair","A winning toke bet can never be re-wagered"]',
 'Only if the guest insists AND a table Manager gives permission',
 'Dealers must take down both the wager and the winning payoff on all toke bets. The toke may only be re-bet if the guest insists and a table Manager approves. PARLAY is not acceptable.',
 'let_it_ride',FALSE,3,10,TRUE),

((SELECT id FROM public.games WHERE name='Let It Ride'),
 'multiple_choice',
 'When is a Straight Flush or Royal Flush progressive jackpot paid relative to other hands at the table?',
 '["After all other players'' hands have been settled","Immediately when identified, before other players","At the same time as all other hands","Only after the manager inserts the payoff key and resets the jackpot first"]',
 'After all other players'' hands have been settled',
 'A Straight Flush or Royal Flush progressive payout is made after all other players'' hands are settled. The manager resets the progressive after payment.',
 'let_it_ride',FALSE,3,10,TRUE);


-- ============================================================
-- PAYOUT DRILLS (20)   extends existing 30 in seed_questions.sql
-- correct_answer = payout ratio; drill displays total active bet;
-- agent types the dollar payout amount.
-- ============================================================

-- Full House  11:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Full House in Let It Ride. What is the correct payout on the total active wager shown?',NULL,'11','A Full House pays 11 to 1 on all active bets.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','The Let It Ride dealer turns over a winning Full House. Calculate the payout on the wager shown.',NULL,'11','Full House: 11 to 1 per active bet in Let It Ride.','let_it_ride',FALSE,3,10,TRUE);

-- Four of a Kind  50:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','The dealer reveals Four of a Kind in Let It Ride. Calculate the total payout on all active bets.',NULL,'50','Four of a Kind pays 50 to 1 on all active Let It Ride bets.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player wins Let It Ride with Four of a Kind. What is the correct payout on the wager shown?',NULL,'50','Four of a Kind: 50 to 1 per active bet in Let It Ride.','let_it_ride',FALSE,3,10,TRUE);

-- Straight Flush  200:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','A Straight Flush is the winning hand in Let It Ride. Calculate the payout on the total active wager shown.',NULL,'200','A Straight Flush pays 200 to 1 on all active bets.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer calls a Straight Flush winner. Calculate the payout on the wager shown.',NULL,'200','Straight Flush: 200 to 1 per active bet in Let It Ride.','let_it_ride',FALSE,3,10,TRUE);

-- Royal Flush  1000:1  (difficulty 3)
-- IMPORTANT: $25,000 maximum payout applies per hand.
-- Keep chip_variants for these questions to low denominations (e.g. $5–$25/spot)
-- so the randomised bet × 1000 stays at or under $25,000.
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Royal Flush in Let It Ride. Calculate the payout on the total active wager shown.',NULL,'1000','A Royal Flush pays 1000 to 1. Total payout is capped at $25,000 per hand.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','A Royal Flush wins in Let It Ride. What is the correct payout on the total active wager shown?',NULL,'1000','Royal Flush: 1000 to 1 per active bet in Let It Ride. Maximum payout is $25,000 per hand.','let_it_ride',FALSE,3,10,TRUE);

-- Flush  8:1  (additional — difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer calls a Flush winner. Calculate the payout on the total active wager shown.',NULL,'8','A Flush pays 8 to 1 on all active bets in Let It Ride.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Winning Flush hand revealed in Let It Ride. What is the correct payout on the wager shown?',NULL,'8','Flush: 8 to 1 per active bet in Let It Ride.','let_it_ride',FALSE,2,10,TRUE);

-- Straight  5:1  (additional — difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer calls a Straight. Calculate the payout on the total active wager shown.',NULL,'5','A Straight pays 5 to 1 in Let It Ride.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player wins Let It Ride with a Straight. What is the total correct payout on the active wager shown?',NULL,'5','Straight: 5 to 1 per active bet.','let_it_ride',FALSE,2,10,TRUE);

-- Three of a Kind  3:1  (additional — difficulty 2)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer reveals Three of a Kind. Calculate the payout on the total active wager shown.',NULL,'3','Three of a Kind pays 3 to 1 on all active bets.','let_it_ride',FALSE,2,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player wins with Three of a Kind in Let It Ride. Calculate the correct payout on the wager shown.',NULL,'3','Three of a Kind: 3 to 1 per active bet in Let It Ride.','let_it_ride',FALSE,2,10,TRUE);

-- Two Pair  2:1  (additional — difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride dealer reveals Two Pair. What is the correct payout on the active wager shown?',NULL,'2','Two Pair pays 2 to 1 in Let It Ride.','let_it_ride',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Winning Two Pair in Let It Ride — calculate the correct total payout on the wager shown.',NULL,'2','Two Pair: 2 to 1 per active bet.','let_it_ride',FALSE,1,10,TRUE);

-- Pair of Tens or better  1:1  (additional — difficulty 1)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Let It Ride: player holds a Pair of Queens. Calculate the payout on the total active wager shown.',NULL,'1','A Pair of Tens or better pays 1 to 1 (even money).','let_it_ride',FALSE,1,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s final hand is a Pair of Aces in Let It Ride. What is the correct payout on the wager shown?',NULL,'1','Pair of Tens or better: 1 to 1 per active bet.','let_it_ride',FALSE,1,10,TRUE);

-- 3 Card Bonus: Straight Flush 40:1 and Three of a Kind 30:1  (difficulty 3)
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s three-card hand qualifies for the 3 Card Bonus with a Straight Flush. Calculate the payout on the bonus wager shown.',NULL,'40','A Straight Flush on the 3 Card Bonus side bet pays 40 to 1.','let_it_ride',FALSE,3,10,TRUE),
((SELECT id FROM public.games WHERE name='Let It Ride'),'payout','Player''s three-card hand qualifies for the 3 Card Bonus with Three of a Kind. Calculate the payout on the bonus wager shown.',NULL,'30','Three of a Kind on the 3 Card Bonus side bet pays 30 to 1.','let_it_ride',FALSE,3,10,TRUE);
