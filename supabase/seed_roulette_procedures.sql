-- ============================================================
-- Stellaris Surveillance Gaming Drills Platform
-- Roulette Safety-Procedure Questions  (30 multiple choice)
--
-- Run this in the Supabase SQL Editor AFTER schema.sql / seed_questions.sql.
--
-- These are shared procedure questions grounded in the casino's
-- Roulette dealer procedures manual (Updated 06-10-2020):
--   game_id      = NULL       (shared — eligible in any session draw)
--   is_procedure = TRUE       (surfaces in the "Procedures" practice tab)
--   type         = 'multiple_choice'
--   category     = 'roulette_procedure'
--
-- correct_answer must EXACTLY match one of the strings in options.
-- Difficulty is balanced: 10 easy (1), 10 medium (2), 10 hard (3).
-- ============================================================

-- ─── Schema patch: add created_at if absent (matches seed_questions.sql) ─────
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================
-- EASY  (difficulty 1)
-- ============================================================
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
(NULL,'multiple_choice','According to the procedures, what are the three most important aspects of a Roulette dealer''s responsibility?','["Professionalism, game security, and customer courtesy","Speed, accuracy, and tips","Chip handling, wheel spinning, and counting","Dress code, punctuality, and attendance"]','Professionalism, game security, and customer courtesy','The manual states the three most important aspects are professionalism, game security, and customer courtesy.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','While dealing at the Roulette table, how should the dealer be positioned relative to the game?','["Face the front of the game at all times and never turn your back on it","Turn away to give players privacy when they bet","Face the wheel only and ignore the layout","Sit with arms folded facing the pit"]','Face the front of the game at all times and never turn your back on it','General conduct rules require the dealer to face the front of the game at all times and never turn their back on the game.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','If a dealer needs to cough or sneeze while on the game, what should they do?','["Use only the back of the hand","Cover the mouth with both hands over the layout","Turn and cough toward the bankroll","Step away from the table without telling anyone"]','Use only the back of the hand','The conduct rules specify that when coughing or sneezing, only the back of the hand may be used.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','Which of the following is prohibited for a dealer while on the game?','["Chewing gum","Announcing the winning number","Marking the winning number with the dolly","Wearing a nametag"]','Chewing gum','The conduct rules state that gum chewing is not allowed and excessive jewelry is not permitted.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','During play, where must the Roulette ball be at all times?','["In the sight of the dealer","Hidden in the dealer''s hand between spins","Held by the table manager","Resting in the chip rack"]','In the sight of the dealer','Game protection requires that the ball must always be in the sight of the dealer.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','When marking the winning number, how should the dealer place the dolly?','["Gently on the center of the number, with the palm facing up","Quickly, tossing it toward the number","With the palm facing down to hide the hand","Only after collecting all the winning bets"]','Gently on the center of the number, with the palm facing up','The dealer holds the dolly with the palm facing up and places it gently on the center of the winning number.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','How many players may use a single color of non-value Roulette chips?','["Only one player may use that color","Up to two players may share a color","Any player at the table may use any color","As many as the table minimum allows"]','Only one player may use that color','Only one color may be issued to a player, and only one person may play with that color.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','Under the Roulette procedures, does cash (currency) ever play as a bet on the layout?','["No — money does not play under any circumstances","Yes, if the amount is under $100","Yes, if the table manager approves","Yes, on outside bets only"]','No — money does not play under any circumstances','The procedures state plainly that money (cash) does not play under any circumstances, and call bets are not accepted.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','What does the dress and personal appearance standard require dealers to wear at all times?','["A nametag","Gloves","A jacket","Sunglasses"]','A nametag','The dress and personal appearance section states that nametags will be worn at all times.','roulette_procedure',TRUE,1,10,TRUE),

(NULL,'multiple_choice','How should a dealer behave toward a customer during a disagreement?','["Stay courteous — never yell at, threaten, or insult a customer","Match the customer''s tone to stand your ground","Warn the customer they will be removed","Stop dealing until the customer apologizes"]','Stay courteous — never yell at, threaten, or insult a customer','Customer relations rules forbid displaying anger; yelling, threatening, or insulting a customer is strictly forbidden.','roulette_procedure',TRUE,1,10,TRUE);


-- ============================================================
-- MEDIUM  (difficulty 2)
-- ============================================================
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
(NULL,'multiple_choice','How does the dealer signal "No More Bets," and when?','["Pass the outside hand over the layout at least 3 spins before the ball drops","Tap the wheel once as the ball drops","Announce it only after the ball has landed","Raise both hands above the head"]','Pass the outside hand over the layout at least 3 spins before the ball drops','The dealer passes the outside hand over the layout to signal and emphasize "No More Bets" at least 3 spins before the ball drops.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','For how much action must a dealer call "checks play"?','["$5 action or more","$1 action or more","$25 action or more","$100 action or more"]','$5 action or more','The conduct rules require the dealer to call "checks play" for $5 action or more.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','When a player brings chips in to be changed, where are those chips placed and what is called out?','["Stacked on the wheel rim, and the dealer calls out ''chip change'' with the amount","Placed in the betting area while the dealer calls the number","Dropped in the drop box immediately","Handed back and forth until the count agrees"]','Stacked on the wheel rim, and the dealer calls out ''chip change'' with the amount','Chips coming in for change are stacked on the wheel rim; the dealer calls out "chip change" and the amount to be changed.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','When making change for a guest, how should the dealer handle the money or chips?','["Never take from or put into a player''s hand — complete the transaction on the layout, verified by a Manager","Take the cash directly from the player''s hand to save time","Complete the change quietly without involving a Manager","Place the new chips directly in the betting area"]','Never take from or put into a player''s hand — complete the transaction on the layout, verified by a Manager','Change must be verified by a Manager, and the dealer must never take cash or chips from, or put them into, a player''s hand.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','If two players claim the same winning bet, what should the dealer do?','["Call a Manager and abide by the Manager''s decision","Split the payout evenly between them","Pay the player who spoke first","Void the bet and refund nothing"]','Call a Manager and abide by the Manager''s decision','Game protection rules require calling a Manager if two players claim the same bet and abiding by the Manager''s decision, avoiding all arguments.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','What is required of a seated player on every spin?','["They must play at least the table minimum every spin","They may skip spins as long as they stay seated","They must bet at least one inside number","They must color up between spins"]','They must play at least the table minimum every spin','Dealer procedure states that a seated player must play the table minimum every spin.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','How should a dealer conduct themselves on a "dead" (no-player) game?','["Maintain an alert posture, don''t lean on the table, and make eye contact and smile at passersby","Relax and lean on the table to rest","Handle the bankroll and equipment to stay busy","Leave the table to talk with other dealers"]','Maintain an alert posture, don''t lean on the table, and make eye contact and smile at passersby','On dead games the dealer must keep an alert posture, avoid leaning on the table, and be cordial to potential players; discouraging them is a disciplinary matter.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','A player asks the dealer how they should bet their money. What is the correct response?','["Explain the possible bets and what they mean, but never tell the player how to bet","Recommend the bet with the best odds","Tell them to ask another player","Place a bet for them based on your judgment"]','Explain the possible bets and what they mean, but never tell the player how to bet','When instructing players, dealers may only inform them of the possible bets and their meaning — never tell a player how to bet their money.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','What is a "sleeper," and how should it be handled?','["A bet left on the table after a player has left — if unclaimed after you pay it, notify the Manager; it is not a toke","A player who falls asleep at the table and must be removed","A chip hidden under another to cheat the payout","A bet placed after ''No More Bets'' that must be voided"]','A bet left on the table after a player has left — if unclaimed after you pay it, notify the Manager; it is not a toke','Sleepers are bets left after a player leaves; if no one claims the bet after it is paid, the dealer notifies the Manager and it is not treated as a toke.','roulette_procedure',TRUE,2,10,TRUE),

(NULL,'multiple_choice','Before all winners are paid, may a player touch or take chips from the winning number?','["No — no one may touch or take from the winning number until everyone has been paid","Yes, they may take their own straight-up bet back","Yes, if the dealer has already marked the number","Yes, once the dolly is placed"]','No — no one may touch or take from the winning number until everyone has been paid','The dealer must not allow any player to touch or take anything from the winning number until everyone has been paid.','roulette_procedure',TRUE,2,10,TRUE);


-- ============================================================
-- HARD  (difficulty 3)
-- ============================================================
INSERT INTO public.questions (game_id,type,question_text,options,correct_answer,explanation,category,is_procedure,difficulty,points,is_active)
VALUES
(NULL,'multiple_choice','When cutting out chips for change, how high are the stacks cut?','["Five high, except $25 and $500 chips which are cut four high","Four high for all denominations","Twenty high for all denominations","Ten high, except $1 chips which are five high"]','Five high, except $25 and $500 chips which are cut four high','Change is cut out in stacks of five high, except for $25 and $500 chips, which are cut four high.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','A "20" lammer is placed on a player''s color chip. What does this indicate about the chip value?','["Each chip is worth $1 (the value is five times the lammer number, so a stack of twenty is worth $20)","Each chip is worth $20","Each chip is worth $5","The player has 20 chips in play"]','Each chip is worth $1 (the value is five times the lammer number, so a stack of twenty is worth $20)','The chip value is five times the number on the lammer: a "20" lammer means a stack of twenty is $20, so each chip is worth $1.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','What is the minimum value a player may assign to non-value (Roulette) chips?','["$1 per chip","$5 per chip","$0.25 per chip","The table minimum per chip"]','$1 per chip','Players assign value to non-value chips when purchased, and $1 per chip is the minimum assigned value.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','How many complete revolutions must the ball make around the track for a spin to be legal?','["4 complete revolutions","2 complete revolutions","6 complete revolutions","10 complete revolutions"]','4 complete revolutions','The ball must make 4 complete revolutions around the track to be a legal spin.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','Which of these situations requires the dealer to call "No Spin"?','["The ball makes fewer than 4 revolutions around the wheel","The ball lands on 0 or 00","A player wins a straight-up bet","The wheel is spun toward the dealer"]','The ball makes fewer than 4 revolutions around the wheel','A "No Spin" is called for fewer than 4 revolutions of the ball, a foreign object on the wheel, the ball spinning with the wheel, the ball flying out, and similar faults.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','If the ball flies out of the wheel during a spin, what is the correct procedure?','["Call ''No Spin,'' put the spare ball into play, and place it in the last winning number for one revolution before spinning again","Retrieve the same ball and continue the spin","Pay all bets as if the last number repeated","Close the table until a manager inspects the wheel"]','Call ''No Spin,'' put the spare ball into play, and place it in the last winning number for one revolution before spinning again','When the ball flies out, the dealer uses the spare ball and, as a courtesy, places it in the last winning number for one revolution before spinning again.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','In what order are inside winning wagers paid?','["Line and Top Line first, then streets, then corners, then splits, and straight-up bets last","Straight-up bets first, then splits, corners, streets, and lines last","Highest dollar amount first regardless of bet type","Whichever bets the player points to first"]','Line and Top Line first, then streets, then corners, then splits, and straight-up bets last','The payout order is Line/Top Line, then Streets, Corners, Splits, and finally Straight Up — paying the bets covering the most numbers first.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','Under whose direction must a correction of an error on the game be made?','["A table games manager who is watching the game","The dealer alone, as quickly as possible","The player who noticed the error","Surveillance, by phone"]','A table games manager who is watching the game','Corrections of errors must be made under the direction of a table games manager who is watching the game, and the dealer must inform the manager immediately when a mistake occurs.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','Which area of the Roulette layout is described as the most vulnerable and requires special attention before the ball drops?','["The Column and Number boxes at the end of the table","The zero and double-zero section","The center of the dozens","The chip rack on the wheel head"]','The Column and Number boxes at the end of the table','The procedures single out the Column and Number boxes at the end of the table as the most vulnerable area; the dealer must know these bets before the ball drops.','roulette_procedure',TRUE,3,10,TRUE),

(NULL,'multiple_choice','Who is permitted to drop the slip in the drop box, and what is the exception?','["Only the Dealer drops the slip — the exception is when two table Managers perform the closing","Any Manager may always drop the slip","Only surveillance may drop the slip","The Dealer and the player drop it together"]','Only the Dealer drops the slip — the exception is when two table Managers perform the closing','Only the Dealer can drop the slip in the drop box; the sole exception is when two table Managers perform the closing, in which case dealers should still verify the slips are complete.','roulette_procedure',TRUE,3,10,TRUE);


-- ============================================================
-- Verify counts
--   SELECT difficulty, COUNT(*) FROM public.questions
--   WHERE category = 'roulette_procedure' GROUP BY difficulty ORDER BY difficulty;
--   Expected: 1 -> 10, 2 -> 10, 3 -> 10  (30 total)
-- ============================================================
