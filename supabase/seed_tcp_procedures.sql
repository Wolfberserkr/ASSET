-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Three Card Poker Safety-Procedure Questions  (30 multiple choice)
--
-- Run this in the Supabase SQL Editor AFTER schema.sql / seed_questions.sql.
--
-- Shared procedure questions grounded in the Three Card Poker dealer
-- procedures manual (Updated 06-09-2020):
--   game_id      = NULL       (shared -- eligible in any session draw)
--   is_procedure = TRUE       (surfaces in the "Procedures" practice tab)
--   type         = 'multiple_choice'
--   category     = 'tcp_procedure'
--
-- correct_answer must EXACTLY match one of the strings in options.
-- Difficulty is balanced: 10 easy (1), 10 medium (2), 10 hard (3).
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
(NULL,'multiple_choice','According to the Three Card Poker procedures, what are the three most important aspects of a dealer''s responsibility?','["Professionalism, game security, and customer courtesy", "Speed, accuracy, and tips", "Shuffling, dealing, and paying", "Dress code, punctuality, and attendance"]','Professionalism, game security, and customer courtesy','The manual lists professionalism, game security, and customer courtesy as the three most important aspects of the dealer''s responsibility.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','Who is permitted to touch a player''s cards during a Three Card Poker hand?','["Only the dealer and the player to whom the cards were dealt", "Any player seated at the table", "The dealer and the player to that player''s left", "Only the table manager"]','Only the dealer and the player to whom the cards were dealt','Only the dealer and the player to whom the cards were dealt may touch that player''s cards.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','Where must players keep their cards during the hand?','["Over the table, in full view of the dealer at all times", "In their lap to keep them private", "Face up on the layout", "Behind their chip stack"]','Over the table, in full view of the dealer at all times','Dealers must make players keep their cards over the table (in full view of the dealer) at all times.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','How should a dealer be positioned while running the game?','["Facing the front of the game at all times", "Turned toward the pit to watch for the manager", "Facing whichever player is acting", "Seated with arms folded"]','Facing the front of the game at all times','General conduct requires dealers to face the front of the game at all times.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','What does the conduct policy say about gum chewing?','["It is not allowed on the casino floor or in public areas", "It is allowed only on dead games", "It is allowed if the manager approves", "It is allowed between shuffles"]','It is not allowed on the casino floor or in public areas','Gum chewing is not allowed on the casino floor or in public areas.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','What must dealers wear at all times per the dress and appearance standard?','["A nametag", "Gloves", "A vest", "Sunglasses"]','A nametag','Nametags will be worn at all times.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','A guest becomes upset and starts to argue. What should the dealer do?','["Never argue with the guest; give the manager as much information as possible and let the manager handle it", "Argue back to defend the house", "Ignore the guest and keep dealing", "Ask the guest to leave the table"]','Never argue with the guest; give the manager as much information as possible and let the manager handle it','Dealers must never argue with a guest; once a situation arises the manager handles it and the dealer provides as much information as possible.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','Which deck is used to play Three Card Poker?','["A standard 52-card deck with no joker", "A 52-card deck plus one joker", "Two 52-card decks shuffled together", "A 40-card Spanish deck"]','A standard 52-card deck with no joker','Three Card Poker is played with a standard 52-card deck, with no joker.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','What is the correct way to treat a customer approaching or passing the table?','["Greet them and make eye contact so they feel welcome to play", "Wait for them to speak first", "Only acknowledge them if they sit down", "Continue dealing without looking up"]','Greet them and make eye contact so they feel welcome to play','Customer relations require greeting the customer and making eye contact so they feel welcome to play.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','On a dead (no-player) game, how should the cards be handled?','["Spread the deck face down in front of the tray and avoid touching the cards unnecessarily", "Keep shuffling continuously to stay sharp", "Fan the cards face up for surveillance", "Place the deck in the discard rack"]','Spread the deck face down in front of the tray and avoid touching the cards unnecessarily','On dead games dealers spread the deck face down in front of the tray and should not touch the cards unnecessarily.','tcp_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','What is the ''Ante'' wager in Three Card Poker?','["The mandatory wager players make before seeing their hand", "An optional side bet on the player''s own hand", "A tip placed for the dealer", "A wager made only after the player sees the dealer''s hand"]','The mandatory wager players make before seeing their hand','The Ante is the mandatory wager players make before seeing their hand.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','If a player decides to ''Play'' after seeing their hand, how large must the Play wager be?','["Equal to the Ante wager", "Double the Ante wager", "Any amount up to the table maximum", "Equal to the Pair Plus wager"]','Equal to the Ante wager','A player who chooses to Play must make an additional wager equal to their Ante.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','A player placed a Pair Plus wager but then folds and does not make a Play wager. What happens?','["The player forfeits both the Pair Plus wager and the Ante wager", "The player keeps the Pair Plus wager but loses the Ante", "The Pair Plus wager is still paid if it qualifies", "Only the Ante is forfeited"]','The player forfeits both the Pair Plus wager and the Ante wager','If a player places a Pair Plus wager but does not make a Play wager, they forfeit the Pair Plus wager as well as the Ante wager.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','A player placed a 6 Card Bonus wager but folds and does not make a Play wager. What happens to the 6 Card Bonus?','["The player is still eligible for the 6 Card Bonus payout", "The 6 Card Bonus is forfeited along with the Ante", "The 6 Card Bonus is refunded but cannot win", "The 6 Card Bonus only pays if the Play wager was made"]','The player is still eligible for the 6 Card Bonus payout','A player who placed a 6 Card Bonus wager remains eligible for that payout even if they fold and do not make a Play wager.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','What is the minimum hand the dealer needs to ''qualify'' and play?','["Queen high or better", "A pair or better", "Ace high or better", "Jack high or better"]','Queen high or better','The dealer must qualify with a minimum of Queen high or better.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','The dealer''s hand does NOT qualify (lower than Queen high). What happens to the player''s Play wager?','["The Play wager is a push", "The Play wager is lost", "The Play wager is paid 2 to 1", "The Play wager is paid based on the player''s hand rank"]','The Play wager is a push','When the dealer does not qualify, the Play wager is a push; the Ante is paid, and the Ante Bonus and Pair Plus are still paid on qualifying hands.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','Under what condition is the Ante Bonus paid?','["On a straight or better, regardless of whether the dealer qualifies", "Only when the dealer qualifies", "Only when the player beats the dealer", "On a pair or better"]','On a straight or better, regardless of whether the dealer qualifies','The Ante Bonus is paid on a straight or better and is paid regardless of whether the dealer qualifies.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','What is the correct procedure when a player folds?','["Collect the losing wager, spread the cards face down to verify three cards, then place them in the discard rack", "Immediately place the cards in the discard rack without checking", "Return the cards to the player", "Turn the cards face up for the table to see"]','Collect the losing wager, spread the cards face down to verify three cards, then place them in the discard rack','On a fold, the dealer collects the losing wager, spreads the cards face down to verify three cards are present, then places them in the discard rack.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','How should a dealer stand at a dead game?','["At parade rest with hands on either side of the chip tray, not leaning and not turning their back to the bankroll", "Leaning on the shuffle machine to rest", "With arms folded facing the pit", "Seated until a player arrives"]','At parade rest with hands on either side of the chip tray, not leaning and not turning their back to the bankroll','At a dead game dealers stand at parade rest with hands on either side of the chip tray; no folded arms, no leaning, and never turning the back to the bankroll.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','Two hands are both a King-high flush but in different suits. How is this resolved?','["It is a push, because suits have no ranking and a flush is ranked by high card only", "The spade flush wins over the diamond flush", "The hand acting first wins", "The dealer always wins ties"]','It is a push, because suits have no ranking and a flush is ranked by high card only','There is no ranking of suits; a flush or straight flush is ranked by high card only, so two King-high flushes are a push.','tcp_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','Which is the highest-paying (top) hand on the Pair Plus pay table?','["Mini Royal Flush (A-K-Q suited)", "Three of a Kind", "Straight Flush", "Flush"]','Mini Royal Flush (A-K-Q suited)','On the Pair Plus pay table the Mini Royal Flush is the top hand, paying 200 to 1.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','How is the 6 Card Bonus hand formed?','["From the player''s three cards plus the dealer''s three cards, using any of the six to make the best five-card hand", "From only the player''s three cards", "From the player''s three cards plus two community cards", "From the dealer''s three cards only"]','From the player''s three cards plus the dealer''s three cards, using any of the six to make the best five-card hand','The 6 Card Bonus considers the three player cards and the three dealer cards; the player uses any of those six to make the best five-card poker hand.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','What is the top (highest-paying) hand on the 6 Card Bonus pay table?','["Royal Flush", "Straight Flush", "Four of a Kind", "Full House"]','Royal Flush','On the 6 Card Bonus pay table the Royal Flush is the top hand, paying 1000 to 1.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','For what size wager must the dealer call out ''checks play''?','["Any bet of $100 or more", "Any bet of $5 or more", "Any bet of $25 or more", "Any bet of $500 or more"]','Any bet of $100 or more','When dealing to any bet of $100 or more, the dealer must call ''checks play'' so the table manager is aware of the action.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','During the deal, MORE THAN ONE card is found face up in the shoe or deck. What is the correct action?','["Void all hands and reshuffle the cards", "Continue the game as normal", "Replace only the exposed cards and continue", "Void only the hands that received a face-up card"]','Void all hands and reshuffle the cards','If more than one card is found face up in the shoe or deck during the deal, all hands are voided and the cards are reshuffled. (A single face-up card: the dealer continues.)','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','A player or the dealer is dealt an incorrect number of cards. What happens?','["All hands are voided and the cards are reshuffled", "Only the misdealt hand is voided", "The extra card is burned and play continues", "The dealer draws replacement cards"]','All hands are voided and the cards are reshuffled','If any player or the dealer is dealt an incorrect number of cards, all hands are voided and the cards are reshuffled.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','The shuffle machine jams and fails to deal all the cards during a round. What is the correct procedure?','["Void the round of play, remove the cards from the device, and reshuffle", "Finish dealing the round by hand", "Pay all wagers as a push and continue", "Wait for the machine to resume and continue the same round"]','Void the round of play, remove the cards from the device, and reshuffle','If the shuffle machine jams, stops, or fails to deal all cards during a round, the round is voided and the cards are removed and reshuffled.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','Under whose direction must a correction of an error on the game be made?','["A table games manager who is watching the game", "The dealer alone, as quickly as possible", "The player who noticed the error", "The cashier"]','A table games manager who is watching the game','Corrections of errors must be made under the direction of a table games manager who is watching the game.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','Why must collected cards be placed in the discard rack in order?','["So each hand can be reconstructed in the event of a question or dispute", "To speed up the next shuffle", "To keep the discard rack tidy for surveillance photos", "So the cards wear evenly"]','So each hand can be reconstructed in the event of a question or dispute','All cards collected are placed in the discard rack in order so they can be readily arranged to reconstruct each hand in the event of a question or dispute.','tcp_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','In Three Card Poker, which hand ranks HIGHER: a Straight or a Flush?','["A Straight ranks higher than a Flush", "A Flush ranks higher than a Straight", "They are equal in rank", "It depends on the suit"]','A Straight ranks higher than a Flush','In the three-card ranking, a Straight ranks higher than a Flush (three-card straights are harder to make than three-card flushes).','tcp_procedure',TRUE,3,10,TRUE);


-- ============================================================
-- Verify counts
--   SELECT difficulty, COUNT(*) FROM public.questions
--   WHERE category = 'tcp_procedure' GROUP BY difficulty ORDER BY difficulty;
--   Expected: 1 -> 10, 2 -> 10, 3 -> 10  (30 total)
-- ============================================================
